# Plantillas de Supabase Auth con la identidad de STRIDE.
# Mismo marco visual que lib/resend.ts (memberAccessEmailHtml): tablas y
# estilos inline para que se vea igual en Gmail, Outlook y Apple Mail.
# Variables Go de Supabase: {{ .SiteURL }} {{ .TokenHash }} {{ .Token }}

def shell(title, intro, cta_label, cta_href, code_intro=None, footer=""):
    code_block = ""
    if code_intro:
        code_block = f"""
        <tr><td style="padding:16px 36px 0">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#6a7186">{code_intro}</p>
        </td></tr>
        <tr><td align="center" style="padding:12px 36px 6px">
          <div style="background:#f1f3fa;border-radius:12px;padding:14px 20px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:28px;letter-spacing:8px;color:#171a24;font-weight:600">{{{{ .Token }}}}</div>
        </td></tr>"""
    return f"""<div style="background:#f2f3f8;padding:32px 16px;font-family:-apple-system,'Segoe UI',system-ui,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(20,22,36,.08)">
      <tr><td align="center" style="background:#0e1017;padding:30px 24px 26px">
        <img src="https://stridechile.cl/stride_logo_clean.png" width="132" alt="STRIDE" style="display:block;max-width:132px;height:auto">
      </td></tr>
      <tr><td style="height:5px;background:#6366f1;background:linear-gradient(90deg,#00E5FF,#6366F1,#FF00FF);font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="padding:36px 36px 8px">
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#171a24">{title}</h1>
        <p style="margin:0 0 8px;font-size:16px;line-height:1.65;color:#3d4254">{intro}</p>
      </td></tr>
      <tr><td align="center" style="padding:18px 36px 10px">
        <a href="{cta_href}" style="display:inline-block;background:#7C3AED;color:#ffffff;padding:15px 34px;border-radius:999px;text-decoration:none;font-weight:700;font-size:16px">{cta_label}</a>
      </td></tr>{code_block}
      <tr><td style="padding:26px 36px 32px">
        <p style="margin:0;padding-top:18px;border-top:1px solid #e8eaf2;font-size:12.5px;line-height:1.6;color:#9aa1b5">{footer}</p>
      </td></tr>
    </table>
    <p style="margin:22px 0 0;font-size:12.5px;color:#9aa1b5;line-height:1.6">
      <em>Correr es la excusa para socializar.</em><br>
      STRIDE · Concepción · <a href="https://stridechile.cl" style="color:#9aa1b5">stridechile.cl</a>
    </p>
  </td></tr></table>
</div>"""

LOGIN = "{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/miembros"
CODE_INTRO = 'Si el botón no funciona, entra a <a href="https://stridechile.cl/miembros/ingresar" style="color:#7C3AED;font-weight:600;text-decoration:none">stridechile.cl/miembros/ingresar</a> y escribe este código:'
FOOT_LOGIN = "El enlace sirve una sola vez y vence en una hora. Si se te pasa, pide uno nuevo con este mismo correo. Si no fuiste tú, ignora este mensaje: nadie puede entrar sin el código."

TEMPLATES = {
  "magic_link": ("Tu acceso a STRIDE ONE",
    shell("Entra a STRIDE ONE", "Toca el botón y quedas dentro de la plataforma: tu plan del mes, los retos, la comunidad y tu carnet con los beneficios.",
          "Entrar a la plataforma", LOGIN, CODE_INTRO, FOOT_LOGIN)),
  "confirmation": ("Confirma tu correo · STRIDE ONE",
    shell("Confirma tu correo", "Solo falta este paso para dejar tu acceso listo. Toca el botón para confirmar que este correo es tuyo.",
          "Confirmar mi correo", "{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/miembros", CODE_INTRO, FOOT_LOGIN)),
  "invite": ("Tu acceso al ERP de STRIDE",
    shell("Bienvenido al equipo 🖤", "Te dieron acceso al ERP de STRIDE, donde se gestionan los eventos, las tareas, los miembros y la comunidad. Toca el botón para definir tu contraseña y entrar.",
          "Definir mi contraseña", "{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/admin/activar", None,
          "El enlace sirve una sola vez y vence en una hora. Después del primer ingreso te vamos a pedir activar el segundo factor: el ERP guarda datos de miembros y finanzas.")),
  "recovery": ("Renueva tu contraseña del ERP",
    shell("Renueva tu contraseña", "Pediste (o te pidieron) definir de nuevo tu contraseña del ERP. Toca el botón para elegir una nueva.",
          "Elegir contraseña nueva", "{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/admin/activar", None,
          "El enlace sirve una sola vez y vence en una hora. Si no fuiste tú, ignora este mensaje: tu contraseña seguirá siendo la misma.")),
}
