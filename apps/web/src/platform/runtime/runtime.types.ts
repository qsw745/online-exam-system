export type AppLifecycleState = 'active' | 'inactive' | 'background'
export type NetworkKind = 'wifi' | 'cellular' | 'none' | 'unknown'

export type RuntimeSnapshot = {
  lifecycle: AppLifecycleState
  connected: boolean
  network: NetworkKind
}

export interface RuntimeAdapter {
  getSnapshot(): Promise<RuntimeSnapshot>
  subscribe(listener: (snapshot: RuntimeSnapshot) => void): Promise<() => void>
}
