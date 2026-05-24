<p align="center">
  <img src="public/war-room-logo.svg" alt="War Room" width="140" height="140" />
</p>

<h1 align="center">War Room</h1>

<p align="center"><strong>Una cabina de mando local y autoalojable para trabajar junto a agentes de IA.</strong></p>

<p align="center">
  <a href="./README.md">English</a> · <strong>Español</strong>
</p>

<p align="center">
  <a href="https://github.com/pythonluvr/war-room/releases"><img src="https://img.shields.io/github/v/release/pythonluvr/war-room?display_name=tag&sort=semver" alt="Última versión"></a>
  <a href="https://discord.gg/ku6GJS92V2"><img src="https://img.shields.io/badge/discord-unirse-5865F2?logo=discord&logoColor=white" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Licencia: MIT"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/contribuciones-bienvenidas-brightgreen.svg" alt="Contribuciones bienvenidas"></a>
</p>

<p align="center">
  <img src="branding/WarBit_Header.png" alt="Un caballero en un escritorio rodeado de cuatro monitores y papeles arrugados, en pleno agotamiento" width="640" />
  <br />
  <em>Trabajo de agentes sin una cabina. Cuatro monitores, café frío, contexto sin unir.</em>
</p>

War Room es una aplicación de escritorio que le da a un equipo pequeño una cabina compartida para el trabajo con agentes que ya están haciendo. Piensa en un layout estilo Discord de servidores y canales, pero cada canal es un espacio de trabajo donde se invoca un agente CLI (Claude Code, Codex, Gemini CLI o el tuyo propio), emparejado con memoria persistente, decisiones, anuncios y una base de conocimiento que todo el equipo ve.

La app corre completamente en la máquina de cada compañero. La estructura del espacio de trabajo se sincroniza por un bus WebSocket contra un servidor de sincronización que el equipo controla. Sin nube administrada, sin facturación por asiento, sin telemetría. Tú aportas tus propios CLI de agentes y tus propias llaves de modelo; War Room solo les da un lugar compartido donde vivir.

## Qué hace

- **Local primero.** Todo el estado vive en la máquina de cada compañero, en SQLite. La aplicación de escritorio funciona totalmente sin conexión. La sincronización es opcional.
- **Layout de servidores y canales.** Barra lateral estilo Discord para organizar el trabajo en servidores, categorías, canales y grupos. Perfiles de agente y frameworks de comportamiento por canal.
- **Trae tu propio agente.** Conecta Claude Code, Codex CLI, Gemini CLI, aider o cualquier CLI personalizado como un "perfil de agente". War Room maneja el ciclo de vida del subproceso, el streaming de salida y el ruteo de canales.
- **Memoria de proyecto persistente.** Decisiones, entradas de conocimiento y restricciones se sincronizan entre el equipo y sobreviven a sesiones. Los agentes las ven, los operadores las auditan.
- **Voz y video en el Boardroom.** Una sala de reuniones impulsada por LiveKit deja al equipo unirse por voz o video junto al trabajo del canal. Autoalojada; no incluimos servidor de medios, tú apuntas a uno que controles.
- **Sistema de aprobaciones.** Cualquier agente o servicio puede pedir confirmación del operador mediante botones estilo Discord. Se queda dentro del espacio de trabajo del equipo; nunca sale de la red.
- **Reacciones y pines.** Reacciones a mensajes del bot para los flujos que ya usas (fijar contexto importante, archivar ruido, sacar respuestas a la superficie).

## Inicio rápido

Descarga el instalador para tu plataforma desde [Releases](https://github.com/pythonluvr/war-room/releases). Ejecútalo, abre la app y tienes una cabina solitaria funcional desde el primer momento. Sin configuración, sin cuentas, sin inicio de sesión.

Los usuarios solitarios pueden detenerse aquí. Todo lo de abajo es para equipos que quieren multijugador.

## Multijugador (sincronización en equipo)

War Room v0.16 trae cuatro modos de hosting para la sincronización del equipo, cada uno expuesto en `Settings → Sync → Host this workspace from this machine`:

| Modo | Qué hace | Ideal para |
|---|---|---|
| Compartir por internet (instantáneo) | Cloudflare Quick Tunnel. Cero cuentas, cero dominios, URL instantánea. | Probar multijugador por primera vez. |
| Compartir por internet (URL permanente) | Cloudflare Named Tunnel. URL estable entre reinicios. | Equipos que quieren "configura y olvida". Requiere una cuenta gratuita de Cloudflare y un dominio. |
| Compartir por red privada | Tailscale. Cada compañero se une al mismo tailnet. El tráfico es directo peer-to-peer. | Equipos enfocados en privacidad que no les importa una instalación por compañero. |
| Conectar a mi propio servidor | Despliegue manual en VPS del servidor de sincronización de referencia. | Equipos que ya se autoalojan o quieren control total. |

Elige un modo, haz click en Host, copia el bloque de invitación, envíalo a tus compañeros. Ellos lo pegan en su propio `Settings → Sync → Connect to a workspace`, le dan Save. Canales, servidores, perfiles de agente, decisiones, anuncios y entradas de conocimiento se sincronizan en vivo a través de todas las máquinas.

Guía completa por modo: [`docs/sync-hosting.md`](./docs/sync-hosting.md). Detalles del protocolo de sincronización: [`SYNC.md`](./SYNC.md).

## Framework de comportamiento (OpenWar)

War Room viene con [**OpenWar**](https://github.com/pythonluvr/openwar) como framework de agente por defecto. OpenWar es un system prompt que hace que cualquier agente (Claude, GPT, Gemini, CLI personalizado) se comporte como un par senior: confirma briefs antes de actuar, divide el trabajo en fases, pregunta antes de acciones destructivas, se niega a inventar próximos pasos no fundamentados en el brief.

El framework es opt-in por canal y globalmente. La selección por defecto vive en `system_settings.default_framework`; las instalaciones nuevas se siembran con `openwar`. Los frameworks son archivos markdown planos en `presets/frameworks/*.md`; deja uno nuevo ahí y aparecerá automáticamente en el wizard y en el chip del header del canal. Sin código de registro, sin manifiesto.

Actualizar frameworks bundleados desde upstream:

```bash
npm run update-frameworks
```

## Voz y video del Boardroom (LiveKit)

La UI del Boardroom está cableada end-to-end contra [LiveKit](https://livekit.io). War Room nunca incluye un servidor de medios; tú apuntas a uno que controles. El instalador embarcado levanta un LiveKit autoalojado en cualquier VPS Linux en unos treinta segundos:

```bash
# En tu VPS como root:
LIVEKIT_DOMAIN=livekit.tu-dominio.com bash tools/install-livekit.sh
# O modo sin dominio para pruebas sobre IP cruda:
bash tools/install-livekit.sh
```

El script instala el binario de LiveKit, genera una API key y secret, escribe `/etc/livekit.yaml`, abre el firewall, opcionalmente configura un vhost de nginx cuando `LIVEKIT_DOMAIN` está definido, y registra el servidor bajo PM2 para que sobreviva reinicios. Al final imprime tres líneas de env para pegar en `~/.war-room/.env` en la máquina de cada compañero.

Opcionalmente, el [transcriptor WhisperX](./tools/whisperx-transcriber/) puede unirse a una llamada como oyente oculto y guardar una transcripción etiquetada por hablante en el Boardroom después. Guía completa de ambos: [`docs/voice-setup.md`](./docs/voice-setup.md).

## Construir desde el código fuente

```bash
git clone https://github.com/pythonluvr/war-room.git
cd war-room
npm install
npm run dev
```

Abre el build de desarrollo en `http://localhost:3000`. Hot reload para el renderer; el main de Electron también recarga al guardar. Build completo del instalador: `npm run build && npm run electron:dist`.

War Room trata cada commit como el primer clone de un desconocido. La config-cero debe producir una app funcional; los estados vacíos son parte del producto, no bugs ocultos detrás de onboarding. Los errores son explicaciones.

## Lo que War Room no es

No es un SaaS administrado. No alojamos nada para los usuarios. Cada equipo corre su propia copia.

No es un cliente de chat con IA. Los agentes son CLIs que War Room invoca y supervisa; la cabina es para el trabajo de coordinación del equipo alrededor de esos agentes, no para la calidad del razonamiento del agente.

No es un reemplazo de Slack o Discord. La superficie de chat es opinionada hacia el trabajo emparejado con agentes. Si quieres chat de equipo general, usa una herramienta hecha para eso.

No es un objetivo de facturación por asiento. Para siempre MIT, para siempre autoalojable, sin tier empresarial escondiendo features detrás de un paywall.

## Documentación

| Tema | Doc |
|---|---|
| Setup de voz y transcripción | [`docs/voice-setup.md`](./docs/voice-setup.md) |
| Modos de hosting de sincronización | [`docs/sync-hosting.md`](./docs/sync-hosting.md) |
| Detalles del protocolo de sincronización | [`SYNC.md`](./SYNC.md) |
| Contribuir | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| Notas de versión | [`CHANGELOG.md`](./CHANGELOG.md) |

## Comunidad

Preguntas, reportes de bugs, discusión de frameworks, ayuda con setup multijugador: [Discord](https://discord.gg/ku6GJS92V2). Issues y PRs bienvenidos en este repo.

## Licencia

[MIT](./LICENSE). Úsalo, modifícalo, forkéalo, córrelo para tu equipo, córrelo para el equipo de alguien más. Construye un producto comercial encima si quieres. Sin compromisos.

## Autoría

War Room está construido alrededor de [OpenWar](https://github.com/pythonluvr/openwar), el framework de comportamiento que viene dentro. Ambos proyectos evolucionan juntos a través del uso real, un envío a la vez, con la disciplina que el resto del ecosistema de agentes mayormente se salta.
