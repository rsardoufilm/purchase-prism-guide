import { colorForUserId, initialsFromName } from "@/lib/group";

interface MemberAvatarProps {
  userId: string | null | undefined;
  name: string | null | undefined;
  /** Tamanho em px do círculo. Default 28. */
  size?: number;
  /** Mostra um anel sutil em volta (para sobreposição em listas). */
  ring?: boolean;
  className?: string;
  title?: string;
}

/**
 * Avatar circular determinístico: inicial + cor derivada do user_id.
 * Sem dependência de imagem — escolha intencional para ser leve nas listas.
 */
export function MemberAvatar({
  userId,
  name,
  size = 28,
  ring = false,
  className = "",
  title,
}: MemberAvatarProps) {
  const { bg, fg } = colorForUserId(userId);
  const initials = initialsFromName(name);
  const fontSize = Math.max(10, Math.round(size * 0.42));
  return (
    <span
      role="img"
      aria-label={name ? `Lançamento de ${name}` : "Membro do grupo"}
      title={title ?? name ?? undefined}
      className={`inline-grid place-items-center rounded-full font-semibold shrink-0 select-none ${ring ? "ring-2 ring-card" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: fg,
        fontSize,
        lineHeight: 1,
      }}
    >
      {initials}
    </span>
  );
}
