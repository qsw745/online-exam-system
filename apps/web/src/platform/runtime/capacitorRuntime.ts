import { App } from '@capacitor/app'
import { Network, type ConnectionType } from '@capacitor/network'

import type { NetworkKind, RuntimeAdapter, RuntimeSnapshot } from './runtime.types'

function toNetworkKind(connectionType: ConnectionType): NetworkKind {
  if (connectionType === 'wifi' || connectionType === 'cellular' || connectionType === 'none') {
    return connectionType
  }
  return 'unknown'
}

export const capacitorRuntime: RuntimeAdapter = {
  async getSnapshot() {
    const [appState, networkState] = await Promise.all([App.getState(), Network.getStatus()])
    return {
      lifecycle: appState.isActive ? 'active' : 'background',
      connected: networkState.connected,
      network: toNetworkKind(networkState.connectionType),
    }
  },

  async subscribe(listener) {
    let snapshot = await this.getSnapshot()
    const publish = (next: RuntimeSnapshot) => {
      snapshot = next
      listener(snapshot)
    }

    const appListener = await App.addListener('appStateChange', ({ isActive }) => {
      publish({ ...snapshot, lifecycle: isActive ? 'active' : 'background' })
    })
    const networkListener = await Network.addListener('networkStatusChange', (status) => {
      publish({
        ...snapshot,
        connected: status.connected,
        network: toNetworkKind(status.connectionType),
      })
    })

    return () => {
      void appListener.remove()
      void networkListener.remove()
    }
  },
}
