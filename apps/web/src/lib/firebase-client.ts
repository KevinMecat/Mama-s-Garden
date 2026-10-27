import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  initializeAuth,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
  connectAuthEmulator,
} from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  getDocFromServer,
  getDocsFromServer,
  doc,
  collection,
  query,
  orderBy,
  documentId,
  limit,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getStorage, ref, getDownloadURL, connectStorageEmulator } from "firebase/storage";
import type { AuthUser, UserRole } from "@/types/auth";

export const FIREBASE_PROJECT = "surco-finca";
export const FIREBASE_BUCKET = "surco-finca.firebasestorage.app";
export type CollectionName =
  | "workers"
  | "salaries"
  | "attendance"
  | "transactions"
  | "microbusinesses"
  | "payrolls"
  | "payments";
export type CloudRow = { id: string; [key: string]: unknown };
let client: ReturnType<typeof createClient> | undefined;
let pending: Promise<ReturnType<typeof createClient>> | undefined;
function createClient(config: FirebaseOptions) {
  const app = initializeApp(config, "mamas-garden-operational");
  const result = {
    auth: initializeAuth(app, { persistence: browserSessionPersistence }),
    db: initializeFirestore(app, { localCache: memoryLocalCache() }),
    storage: getStorage(app, `gs://${config.storageBucket}`),
  };
  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1" && window.location.hostname === "127.0.0.1") {
    connectAuthEmulator(result.auth, "http://127.0.0.1:9399", { disableWarnings: true });
    connectFirestoreEmulator(result.db, "127.0.0.1", 8381);
    connectStorageEmulator(result.storage, "127.0.0.1", 9398);
  }
  return result;
}
export async function firebaseClient() {
  if (typeof window === "undefined")
    throw new Error("Firebase solo se inicia en el navegador.");
  if (client) return client;
  pending ??= (async () => {
    if (process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1" && window.location.hostname === "127.0.0.1") {
      client = createClient({ projectId: "demo-workforce-browser", apiKey: "emulator-public-key", authDomain: "demo-workforce-browser.firebaseapp.com", storageBucket: "demo-workforce-browser.appspot.com", appId: "emulator-browser" });
      return client;
    }
    // Firebase Hosting provides this public configuration. No admin credential is bundled.
    const response = await fetch("/__/firebase/init.json", {
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        "No se pudo cargar la configuración de Firebase Hosting.",
      );
    const config = (await response.json()) as FirebaseOptions;
    if (
      config.projectId !== FIREBASE_PROJECT ||
      config.storageBucket !== FIREBASE_BUCKET ||
      config.authDomain !== "surco-finca.firebaseapp.com" ||
      !config.apiKey ||
      !config.appId
    )
      throw new Error("La configuración no corresponde a surco-finca.");
    client = createClient(config);
    return client;
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
const roles: Record<string, UserRole> = {
  admin: "ADMIN",
  manager: "MANAGER",
  worker: "WORKER",
  supervisor: "SUPERVISOR",
};
const labels: Record<string, string> = {
  admin: "Administrador",
  manager: "Encargado",
  worker: "Trabajador",
  supervisor: "Encargado",
};
async function profile(user: User): Promise<AuthUser> {
  const { db } = await firebaseClient();
  const snapshot = await getDocFromServer(doc(db, "users", user.uid));
  const data = snapshot.data();
  if (!snapshot.exists() || data?.active !== true || !roles[String(data.role)])
    throw new Error("El perfil no está activo o autorizado.");
  return {
    id: user.uid,
    email: user.email || "",
    first_name: String(data.displayName || user.displayName || "Usuario"),
    last_name: "",
    role: roles[String(data.role)],
    role_label: labels[String(data.role)],
  };
}
export async function firebaseCurrentUser() {
  const { auth } = await firebaseClient();
  await auth.authStateReady();
  return auth.currentUser ? profile(auth.currentUser) : null;
}
export async function firebaseLogin(email: string, password: string) {
  const { auth } = await firebaseClient();
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return await profile(credential.user);
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}
export async function firebaseLogout() {
  const { auth } = await firebaseClient();
  await signOut(auth);
}
export function allowedCollections(role: UserRole): CollectionName[] {
  if (role === "ADMIN")
    return [
      "workers",
      "salaries",
      "attendance",
      "transactions",
      "microbusinesses",
      "payrolls",
      "payments",
    ];
  if (role === "MANAGER")
    return ["workers", "microbusinesses", "attendance"];
  if (role === "SUPERVISOR") return ["workers", "microbusinesses", "attendance"];
  return ["workers", "microbusinesses", "attendance"];
}
export async function readCollection(
  name: CollectionName,
  user: AuthUser,
): Promise<CloudRow[]> {
  if (!allowedCollections(user.role).includes(name))
    throw new Error("Tu rol no tiene acceso a esta colección.");
  const { db } = await firebaseClient();
  if (name === "workers" && user.role === "WORKER") {
    const binding = await getDocFromServer(doc(db, "workforce_accounts", String(user.id)));
    if (!binding.exists()) return [];
    const row = await getDocFromServer(doc(db, "workers", String(binding.data().workerId)));
    return row.exists() ? [{ ...row.data(), id: row.id }] : [];
  }
  const result: CloudRow[] = [];
  let last: QueryDocumentSnapshot<DocumentData> | undefined;
  for (;;) {
    const filters = [
      orderBy(documentId()),
      limit(300),
      ...(last ? [startAfter(last)] : []),
      ...(name === "workers" && ["SUPERVISOR", "MANAGER"].includes(user.role)
        ? [where("status", "==", "active")]
        : []),
    ];
    const page = await getDocsFromServer(
      query(collection(db, name), ...filters),
    );
    result.push(...page.docs.map((item) => ({ ...item.data(), id: item.id })));
    if (page.size < 300) return result;
    last = page.docs.at(-1);
  }
}
export function storagePath(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    if (value.startsWith("https://")) {
      const url = new URL(value);
      const prefix = `/v0/b/${FIREBASE_BUCKET}/o/`;
      return url.hostname === "firebasestorage.googleapis.com" &&
        url.pathname.startsWith(prefix)
        ? decodeURIComponent(url.pathname.slice(prefix.length))
        : null;
    }
    if (value.startsWith(`gs://${FIREBASE_BUCKET}/`))
      return value.slice(`gs://${FIREBASE_BUCKET}/`.length);
    return /^(trabajadores|facturas|transaction-receipts|microbusinesses)\//.test(
      value,
    ) && !value.includes("..")
      ? value
      : null;
  } catch {
    return null;
  }
}
export async function readStorageUrl(value: unknown): Promise<string> {
  const path = storagePath(value);
  if (!path) throw new Error("Referencia de archivo no permitida.");
  const { auth, storage } = await firebaseClient();
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error("Inicia sesión para ver archivos.");
  // Metadata is authorized by the existing Storage rules. No token or object is created.
  return getDownloadURL(ref(storage, path));
}
export async function searchFirebaseRecords(user: AuthUser) {
  const names = allowedCollections(user.role);
  const results: { href: string; label: string; context: string }[] = [];
  if (names.includes("microbusinesses"))
    for (const unit of await readCollection("microbusinesses", user))
      results.push({
        href: `/dashboard/projects/detail?id=${encodeURIComponent(unit.id)}`,
        label: String(unit.name || "Unidad"),
        context: "Unidad",
      });
  if (names.includes("workers"))
    for (const person of await readCollection("workers", user))
      results.push({
        href: `/dashboard/employees?worker=${encodeURIComponent(person.id)}`,
        label: `${person.firstName || ""} ${person.lastName || ""}`.trim(),
        context: "Personal",
      });
  return results;
}
