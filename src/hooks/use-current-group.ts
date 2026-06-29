import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GroupMember {
  user_id: string;
  papel: "admin" | "membro";
  entrou_em: string;
  display_name: string | null;
}

export interface CurrentGroup {
  id: string;
  nome_grupo: string;
  criado_por: string;
  codigo_convite: string;
  criado_em: string;
}

interface UseCurrentGroupResult {
  loading: boolean;
  userId: string | null;
  group: CurrentGroup | null;
  members: GroupMember[];
  membersById: Map<string, GroupMember>;
  isInGroup: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

/**
 * Lê o grupo atual do usuário logado + lista de membros (com display_name).
 * Atualiza reativamente a eventos `aura:group-changed` e a INSERT/DELETE em
 * `membros_grupo` (via realtime — habilitado na migração).
 */
export function useCurrentGroup(): UseCurrentGroupResult {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<CurrentGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setUserId(uid);
      if (!uid) {
        setGroup(null);
        setMembers([]);
        return;
      }

      const { data: meRow } = await supabase
        .from("membros_grupo")
        .select("grupo_id")
        .eq("user_id", uid)
        .maybeSingle();

      const groupId = meRow?.grupo_id ?? null;
      if (!groupId) {
        setGroup(null);
        setMembers([]);
        return;
      }

      const { data: g } = await supabase
        .from("grupos_familiares")
        .select("id,nome_grupo,criado_por,codigo_convite,criado_em")
        .eq("id", groupId)
        .maybeSingle();
      setGroup((g as CurrentGroup) ?? null);

      const { data: ms } = await supabase
        .from("membros_grupo")
        .select("user_id,papel,entrou_em")
        .eq("grupo_id", groupId);

      const memberIds = (ms ?? []).map((m) => m.user_id);
      const { data: profs } = memberIds.length
        ? await supabase
            .from("profiles")
            .select("id,display_name")
            .in("id", memberIds)
        : { data: [] as { id: string; display_name: string | null }[] };
      const nameById = new Map((profs ?? []).map((p) => [p.id, p.display_name]));

      setMembers(
        (ms ?? []).map((m) => ({
          user_id: m.user_id,
          papel: m.papel as "admin" | "membro",
          entrou_em: m.entrou_em,
          display_name: nameById.get(m.user_id) ?? null,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("aura:group-changed", onChange);
    return () => window.removeEventListener("aura:group-changed", onChange);
  }, [load]);

  // Realtime: muda alguém entra/sai do grupo → recarrega.
  useEffect(() => {
    if (!group?.id) return;
    const channel = supabase
      .channel(`group-members-${group.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "membros_grupo", filter: `grupo_id=eq.${group.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [group?.id, load]);

  const membersById = new Map(members.map((m) => [m.user_id, m]));
  const isAdmin = !!(group && userId && group.criado_por === userId);

  return {
    loading,
    userId,
    group,
    members,
    membersById,
    isInGroup: !!group,
    isAdmin,
    refresh: load,
  };
}
