// @vitest-environment jsdom

import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Dialog } from './Dialog'
import { TabPanel, Tabs, type TabOption } from './Tabs'
import { Toggle } from './Toggle'

function DialogHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Открыть настройки</button>
      {open && (
        <Dialog titleId="test-dialog-title" onClose={() => setOpen(false)}>
          <h2 id="test-dialog-title">Настройки пути</h2>
          <button>Первое действие</button>
          <button>Последнее действие</button>
        </Dialog>
      )}
    </>
  )
}

describe('Dialog', () => {
  it('announces itself, traps focus, closes on Escape and restores focus', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: 'Открыть настройки' })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Настройки пути' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const buttons = screen.getAllByRole('button')
    const closeButton = screen.getByRole('button', { name: 'Закрыть окно' })
    const lastButton = screen.getByRole('button', { name: 'Последнее действие' })
    expect(closeButton).toBe(document.activeElement)

    lastButton.focus()
    await user.tab()
    expect(closeButton).toBe(document.activeElement)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toBe(document.activeElement)
    expect(buttons.length).toBeGreaterThan(2)
  })
})

type TestTab = 'map' | 'ship' | 'fate'

function TabsHarness() {
  const [tab, setTab] = useState<TestTab>('map')
  const options: TabOption<TestTab>[] = [
    { id: 'map', label: 'Карта' },
    { id: 'ship', label: 'Судно' },
    { id: 'fate', label: 'Судьба' },
  ]
  return (
    <>
      <Tabs idBase="test-tabs" value={tab} options={options} onChange={setTab} ariaLabel="Разделы мира" />
      <TabPanel idBase="test-tabs" tabId={tab}>{tab}</TabPanel>
    </>
  )
}

describe('Tabs', () => {
  it('uses semantic tabs and responds to arrows, Home and End', async () => {
    const user = userEvent.setup()
    render(<TabsHarness />)
    const map = screen.getByRole('tab', { name: 'Карта' })
    map.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Судно' }).getAttribute('aria-selected')).toBe('true')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Судьба' }).getAttribute('aria-selected')).toBe('true')
    await user.keyboard('{Home}')
    expect(map.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toBe('map')
  })
})

describe('Toggle', () => {
  it('exposes a switch state to assistive technology', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [checked, setChecked] = useState(false)
      return <Toggle checked={checked} onChange={setChecked} label="Высокий контраст" />
    }
    render(<Harness />)
    const toggle = screen.getByRole('switch', { name: 'Высокий контраст' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    await user.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('true')
  })
})
