import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Logo } from '../components/Logo'

describe('Logo', () => {
  it('renderiza a imagem do logo por padrão', () => {
    render(<Logo />)
    const img = screen.getByAltText('Logo da Campanha')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/logo.png')
  })

  it('aceita className customizado', () => {
    render(<Logo className="h-12 w-auto" />)
    const img = screen.getByAltText('Logo da Campanha')
    expect(img.className).toContain('h-12')
  })
})
