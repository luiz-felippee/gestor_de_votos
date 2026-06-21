/**
 * Envio de e-mail via Resend (API HTTP simples) — sem dependência extra.
 *
 * Variáveis de ambiente:
 *  - RESEND_API_KEY : chave da conta Resend (https://resend.com). Sem ela, o
 *                     sistema cai no modo DEV (apenas loga no console).
 *  - EMAIL_FROM     : remetente, ex.: "Gestor de Votos <no-reply@seudominio.com>".
 *                     Em teste, pode usar "Gestor de Votos <onboarding@resend.dev>"
 *                     (só envia para o e-mail dono da conta Resend).
 */
export async function enviarEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Gestor de Votos <onboarding@resend.dev>';

  // Modo DEV: sem chave, apenas registra no console (não quebra o fluxo).
  if (!apiKey) {
    console.log('[EMAIL:DEV] RESEND_API_KEY não configurada — e-mail NÃO enviado.');
    console.log(`[EMAIL:DEV] Para: ${opts.to} | Assunto: ${opts.subject}`);
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[EMAIL] Falha no envio (Resend):', res.status, txt);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[EMAIL] Erro ao enviar:', err);
    return false;
  }
}

/** Template HTML do e-mail de recuperação de senha. */
export function templateResetSenha(nome: string, link: string): string {
  const saudacao = nome ? `Olá, ${nome}` : 'Olá';
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:#f1f5f9;padding:32px">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:linear-gradient(135deg,#4f46e5,#4338ca);padding:24px 28px">
        <span style="color:#fff;font-size:18px;font-weight:800">Gestor de Votos</span>
      </div>
      <div style="padding:28px">
        <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px">Redefinir sua senha</h1>
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px">
          ${saudacao}, recebemos um pedido para redefinir a senha da sua conta.
          Clique no botão abaixo para criar uma nova senha. Este link expira em <b>1 hora</b>.
        </p>
        <a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">
          Redefinir senha
        </a>
        <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:22px 0 0">
          Se você não pediu isso, pode ignorar este e-mail com segurança — sua senha continua a mesma.
        </p>
        <p style="font-size:12px;color:#94a3b8;margin:14px 0 0;word-break:break-all">
          Ou copie e cole este endereço no navegador:<br>${link}
        </p>
      </div>
    </div>
  </div>`;
}
