"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMatchStore } from "@/store/match-store";
import { useToast } from "@/hooks/use-toast";
import { FieldCanvas } from "@/components/field/field-canvas";
import { TimerComponent } from "@/components/timer/timer-component";
import { EventTimeline } from "@/components/timeline/event-timeline";
import { RosterSetup } from "@/components/roster/roster-setup";
import { PlayerPanel } from "@/components/roster/player-panel";
import { EventDialog } from "@/components/events/event-dialog";
import { EventButtons } from "@/components/events/event-buttons";
import { Modal } from "@/components/ui/modal";
import { useMatchHotkeys, HOTKEY_MAPPINGS } from "@/hooks/use-hotkeys";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Keyboard } from "lucide-react";
import api from "@/lib/api";

export default function MatchCenterPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const matchId = params.id as string;
  const { match, setMatch, selectedPlayerId, addEvent } = useMatchStore();

  const [showHotkeys, setShowHotkeys] = useState(false);
  const [pendingEventType, setPendingEventType] = useState<string | null>(null);
  const [showLineupModal, setShowLineupModal] = useState(false);
  const [lineupSide, setLineupSide] = useState<"home" | "away">("home");

  const queryReadOnly = searchParams.get("readonly");
  const isReadOnlyQuery = queryReadOnly === "1" || queryReadOnly === "true";
  const isReadOnly = match?.status === "FINISHED" || isReadOnlyQuery;
  const isLive = (match?.status === "LIVE" || match?.status === "HALFTIME") && !isReadOnly;

  const triggerEvent = useCallback(
    async (eventType: string) => {
      if (!match) return;
      if (isReadOnly) {
        toast({
          title: "Solo lectura",
          description: "El partido está finalizado y no admite cambios.",
        });
        return;
      }
      if (!isLive) {
        toast({
          title: "Partido no iniciado",
          description: "Inicia el cronómetro para registrar eventos",
          variant: "destructive",
        });
        return;
      }
      if (eventType === "SUBSTITUTION") {
        setPendingEventType(eventType);
        return;
      }

      const selectedRoster = match.roster.find(
        (r: any) => r.id === selectedPlayerId,
      );
      if (!selectedRoster) {
        setPendingEventType(eventType);
        return;
      }

      try {
        const minute = Math.floor(match.elapsedSeconds / 60);
        const second = match.elapsedSeconds % 60;
        const response = await api.post(`/matches/${matchId}/events`, {
          rosterPlayerId: selectedRoster.id,
          teamSide: selectedRoster.isHomeTeam ? "HOME" : "AWAY",
          eventType,
          period: match.currentPeriod,
          minute,
          second,
        });
        addEvent(response.data);
        toast({ title: "Evento registrado" });
      } catch (error: any) {
        toast({
          title: "Error",
          description:
            error.response?.data?.message || "No se pudo registrar el evento",
          variant: "destructive",
        });
      }
    },
    [addEvent, isLive, isReadOnly, match, matchId, selectedPlayerId, toast],
  );

  useMatchHotkeys({
    matchId,
    isEnabled: isLive ?? false,
    onEventTriggered: triggerEvent,
  });

  const fetchMatch = useCallback(async () => {
    try {
      const response = await api.get(`/matches/${matchId}`);
      setMatch(response.data);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cargar el partido",
        variant: "destructive",
      });
      router.push("/dashboard");
    }
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
  }, [matchId]);

  const handleExport = async () => {
    try {
      const response = await api.get(`/matches/${matchId}/export`);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `match-${matchId}-${new Date().toISOString()}.json`;
      a.click();
      toast({ title: "Partido exportado" });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo exportar",
        variant: "destructive",
      });
    }
  };

  if (!match) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Cargando partido...</p>
      </div>
    );
  }

  const homeGoals = match.events.filter(
    (e: any) => e.teamSide === "HOME" && e.eventType === "GOAL",
  ).length;
  const awayGoals = match.events.filter(
    (e: any) => e.teamSide === "AWAY" && e.eventType === "GOAL",
  ).length;
  const isSetup = match.status === "SETUP";
  const homeStarters = match.roster.filter(
    (r: any) => r.isHomeTeam && r.isStarter,
  ).length;
  const awayStarters = match.roster.filter(
    (r: any) => !r.isHomeTeam && r.isStarter,
  ).length;
  const shouldShowSetup =
    isSetup && !(homeStarters === 11 && awayStarters === 11);
  const selectedRosterPlayer = match.roster.find(
    (r: any) => r.id === selectedPlayerId,
  );
  const selectedName = selectedRosterPlayer
    ? `${selectedRosterPlayer.jerseyNumber} ${selectedRosterPlayer.customName || selectedRosterPlayer.player?.lastName || ""}`
    : null;
  const homeTeamLabel = match.homeTeam.shortName || match.homeTeam.name;
  const awayTeamLabel = match.awayTeam.shortName || match.awayTeam.name;

  function openLineup(side: "home" | "away") {
    setLineupSide(side);
    setShowLineupModal(true);
  }

  return (
    <div className="space-y-4">
      {shouldShowSetup ? (
        <RosterSetup matchId={matchId} onConfirmed={fetchMatch} />
      ) : (
        <>
          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[90px]">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      {match.homeTeam.shortName || match.homeTeam.name}
                    </div>
                    <div className="text-4xl font-bold">{homeGoals}</div>
                  </div>
                  <div className="text-2xl text-muted-foreground font-light">—</div>
                  <div className="text-center min-w-[90px]">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      {match.awayTeam.shortName || match.awayTeam.name}
                    </div>
                    <div className="text-4xl font-bold">{awayGoals}</div>
                  </div>
                  <span
                    className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                      match.status === "LIVE"
                        ? "bg-green-100 text-green-800"
                        : match.status === "HALFTIME"
                          ? "bg-yellow-100 text-yellow-800"
                          : match.status === "FINISHED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {{
                      SETUP: "Configuración",
                      LIVE: "En Vivo",
                      HALFTIME: "Entretiempo",
                      FINISHED: "Finalizado",
                    }[match.status]}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowHotkeys(!showHotkeys)}>
                    <Keyboard className="mr-2 h-4 w-4" />
                    Atajos
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {showHotkeys && (
            <Card>
              <CardContent className="py-3">
                <div className="flex flex-wrap gap-3 justify-center">
                  {Object.entries(HOTKEY_MAPPINGS).map(([key, label]) => (
                    <div key={key} className="text-center">
                      <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded uppercase">{key}</kbd>
                      <p className="text-xs mt-1 text-muted-foreground">{label}</p>
                    </div>
                  ))}
                  <div className="text-center">
                    <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border rounded">ESC</kbd>
                    <p className="text-xs mt-1 text-muted-foreground">Deselec.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[0.98fr_1.02fr] xl:grid-cols-[0.95fr_1.05fr] gap-4 items-start">
            <div className="min-w-0 overflow-hidden">
              <FieldCanvas matchId={matchId} readOnly={isReadOnly} />
                <Card>
                <CardContent className="py-4 space-y-3">
                  <div className="rounded-lg border p-3 bg-white">
                    <p className="text-sm font-semibold mb-2">Panel de eventos</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      {isReadOnly
                        ? "Partido finalizado: solo lectura."
                        : isLive
                        ? "Selecciona un jugador y registra eventos al instante."
                        : "Partido no iniciado o finalizado. Los botones están en modo lectura."}
                    </p>
                    <EventButtons onEvent={triggerEvent} disabled={!isLive || isReadOnly} />
                  </div>

                  <div className="rounded-lg border p-2 bg-white">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Alineaciones (compacto)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="justify-start" onClick={() => openLineup("home")}>
                        {homeTeamLabel}
                      </Button>
                      <Button variant="outline" className="justify-start" onClick={() => openLineup("away")}>
                        {awayTeamLabel}
                      </Button>
                    </div>
                  </div>

                  {selectedName ? (
                    <p className="text-xs text-yellow-700 font-medium bg-yellow-50 rounded px-2 py-1.5 w-fit">
                      ✔ Seleccionado: {selectedName}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Selecciona un jugador para registrar sin popup.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <TimerComponent matchId={matchId} readOnly={isReadOnly} />
              <EventTimeline matchId={matchId} readOnly={isReadOnly} />

            
            </div>
          </div>
        </>
      )}

      {pendingEventType && (
        <EventDialog
          matchId={matchId}
          eventType={pendingEventType}
          onClose={() => setPendingEventType(null)}
        />
      )}

      {showLineupModal && (
        <Modal title="Alineaciones del partido" onClose={() => setShowLineupModal(false)} maxWidth="lg">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={lineupSide === "home" ? "default" : "outline"}
                onClick={() => setLineupSide("home")}
                className="justify-start"
              >
                {homeTeamLabel}
              </Button>
              <Button
                variant={lineupSide === "away" ? "default" : "outline"}
                onClick={() => setLineupSide("away")}
                className="justify-start"
              >
                {awayTeamLabel}
              </Button>
            </div>
            <div className="rounded-lg border p-2">
              <PlayerPanel side={lineupSide} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
