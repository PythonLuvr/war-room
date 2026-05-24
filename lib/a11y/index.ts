/**
 * Utilidades de accesibilidad para War Room.
 * Añadidas en el fork accessible-es para soporte de VoiceOver / NVDA / JAWS.
 *
 * Para contribuir estos cambios al proyecto original:
 *   https://github.com/PythonLuvr/war-room
 */

/**
 * Genera props aria para un botón que solo contiene un icono.
 * Uso: <button {...iconButton("Crear canal")}>
 */
export function iconButton(label: string): {
  "aria-label": string;
  title: string;
} {
  return { "aria-label": label, title: label };
}

/**
 * Props para indicar el elemento activo en una lista de navegación.
 * Uso: <button {...ariaCurrent(isActive)}>
 */
export function ariaCurrent(
  active: boolean
): { "aria-current": "page" | undefined } {
  return { "aria-current": active ? "page" : undefined };
}

/**
 * Props para un botón de colapsar/expandir sección.
 * Uso: <button {...ariaExpanded(isOpen, "Canales del territorio")}>
 */
export function ariaExpanded(
  expanded: boolean,
  label: string
): {
  "aria-expanded": boolean;
  "aria-label": string;
} {
  return {
    "aria-expanded": expanded,
    "aria-label": `${label}, ${expanded ? "contraer" : "expandir"}`,
  };
}

/**
 * Props para una región de chat con anuncios en tiempo real.
 * Aplica al contenedor de mensajes del canal.
 * "polite" anuncia cuando el usuario termina de hablar; no interrumpe.
 */
export const chatLogProps = {
  role: "log" as const,
  "aria-live": "polite" as const,
  "aria-label": "Mensajes del canal",
  "aria-relevant": "additions" as const,
};

/**
 * Props para el campo de texto del compositor de mensajes.
 */
export function composerProps(channelName: string): {
  id: string;
  "aria-label": string;
  "aria-describedby": string;
} {
  return {
    id: "chat-composer",
    "aria-label": `Mensaje para #${channelName}`,
    "aria-describedby": "chat-composer-hint",
  };
}

/**
 * Props para una región de estado (alertas, notificaciones transitorias).
 * El contenido se anuncia automáticamente al cambiar.
 */
export const statusRegionProps = {
  role: "status" as const,
  "aria-live": "polite" as const,
  "aria-atomic": true,
};

/**
 * Props para un diálogo modal accesible.
 * Uso: <div {...modalProps("Crear servidor")} ref={containerRef}>
 */
export function modalProps(title: string): {
  role: "dialog";
  "aria-modal": true;
  "aria-label": string;
} {
  return {
    role: "dialog",
    "aria-modal": true,
    "aria-label": title,
  };
}
