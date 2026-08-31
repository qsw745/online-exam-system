import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RuntimeProvider, useRuntime } from './RuntimeProvider'
import type { RuntimeAdapter, RuntimeSnapshot } from './runtime.types'

class FakeRuntimeAdapter implements RuntimeAdapter {
  private readonly listeners = new Set<(snapshot: RuntimeSnapshot) => void>()

  constructor(private snapshot: RuntimeSnapshot) {}

  async getSnapshot() {
    return this.snapshot
  }

  async subscribe(listener: (snapshot: RuntimeSnapshot) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(snapshot: RuntimeSnapshot) {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener(snapshot)
  }

  listenerCount() {
    return this.listeners.size
  }
}

function RuntimeProbe() {
  const { ready, snapshot } = useRuntime()
  return (
    <output>
      {ready ? 'ready' : 'loading'}:{snapshot.lifecycle}:{String(snapshot.connected)}:{snapshot.network}
    </output>
  )
}

describe('RuntimeProvider', () => {
  it('载入适配器初值并响应网络与生命周期变化', async () => {
    const adapter = new FakeRuntimeAdapter({ lifecycle: 'active', connected: true, network: 'wifi' })

    render(
      <RuntimeProvider adapter={adapter}>
        <RuntimeProbe />
      </RuntimeProvider>,
    )

    expect(await screen.findByText('ready:active:true:wifi')).toBeInTheDocument()

    act(() => {
      adapter.emit({ lifecycle: 'background', connected: false, network: 'none' })
    })

    expect(screen.getByText('ready:background:false:none')).toBeInTheDocument()
  })

  it('卸载时移除运行时监听', async () => {
    const adapter = new FakeRuntimeAdapter({ lifecycle: 'active', connected: true, network: 'unknown' })
    const view = render(
      <RuntimeProvider adapter={adapter}>
        <RuntimeProbe />
      </RuntimeProvider>,
    )

    await waitFor(() => expect(adapter.listenerCount()).toBe(1))
    view.unmount()

    expect(adapter.listenerCount()).toBe(0)
  })
})
