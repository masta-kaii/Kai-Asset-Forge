declare module "firebase/app" {
  export interface FirebaseApp {
    name: string
    options: Record<string, unknown>
    automaticDataCollectionEnabled: boolean
  }
  export function initializeApp(options: Record<string, unknown>, name?: string): FirebaseApp
  export function getApps(): FirebaseApp[]
  export function getApp(name?: string): FirebaseApp
  export function deleteApp(app: FirebaseApp): Promise<void>
}

declare module "firebase/firestore" {
  export function getFirestore(app?: import("firebase/app").FirebaseApp): unknown
}

declare module "firebase/auth" {
  export function getAuth(app?: import("firebase/app").FirebaseApp): unknown
}

declare module "firebase/storage" {
  export function getStorage(app?: import("firebase/app").FirebaseApp): unknown
}
