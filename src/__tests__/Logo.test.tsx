import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Logo } from '../components/Logo'

describe('Logo', () => {
  it('renderiza a imagem do logo por padrão', () => {
    render(<Logo />)
    const img = screen.getByAltText('Gestor de Votos')
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toContain('/icon-192.png')
  })

  it('aceita iconClassName customizado', () => {
    const { container } = render(<Logo iconClassName="h-12 w-auto" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('h-12')
  })
})
