/**
 * LightsWidget — Area-based light control widget formatted as a table by floor.
 * Groups lights by floor, exposes per-room brightness sliders, scene shortcuts,
 * individual light control, and an optional 24h timeline chart for the area's master light.
 */
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '../ui/Skeleton';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { Slider } from '../ui/Slider';
import { BaseWidget, WidgetHighlight } from './BaseWidget';
import { HAState } from '../../services/api';
import { useOnOffHistory } from '../../hooks/useOnOffHistory';
import { TimelineChart } from '../ui/TimelineChart';
import { Panel } from '../ui/Panel';
import { useWidgetPreferences } from '../../context/WidgetPreferencesContext';
import { PowerButton } from '../ui/PowerButton';
import { cn } from '../../lib/utils';

import { isHueLight } from '../../lib/ha-groups';
import { useElementWidth } from '../../hooks/useElementWidth';
import { toggleProps } from '../../lib/a11y';
import { OTHER_FLOOR, compareByUserOrder, compareFloors, groupByFloor } from '../../lib/floors';
import { AreaIcon } from '../ui/AreaIcon';

interface LightsWidgetProps {
  lights: HAState[];
  scenes?: HAState[];
  metadata?: Record<string, { area: string; floor?: string; model: string }>;
  onToggle: (entityId: string, newState: boolean) => void;
  onSetBrightness: (entityId: string, brightness: number) => void;
  onActivateScene?: (entityId: string, sceneName: string, activeRoomLightIds: string[]) => void;
  getLightState?: (entity: HAState) => boolean;
  getLightBrightness?: (entity: HAState) => number;
  showHistory?: boolean;
}

/**
 * Lights per room with brightness, scenes and on/off history.
 *
 * @param props - Lights, scenes and light actions.
 * @returns The widget.
 */
export const LightsWidget = memo(function LightsWidget({
  lights,
  scenes = [],
  metadata = {},
  onToggle,
  onSetBrightness,
  onActivateScene,
  getLightState,
  getLightBrightness,
  showHistory = true,
}: LightsWidgetProps) {
  const { floorOrder, roomOrder, isRoomHidden, roomIcons } = useWidgetPreferences();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [sliderValue, setSliderValue] = useState(0);
  const [chartContainerRef, chartWidth] = useElementWidth();

  const rooms = useMemo(() => {
    const groups: Record<string, HAState[]> = {};
    lights.filter(isHueLight).forEach((light) => {
      const area = metadata[light.entity_id]?.area || 'Autres';
      if (!groups[area]) groups[area] = [];
      groups[area].push(light);
    });

    const mapped = Object.keys(groups).map((area) => {
      const areaLights = groups[area];
      const onLights = areaLights.filter((l) =>
        getLightState ? getLightState(l) : l.state === 'on',
      );
      const areaScenes = scenes
        .filter((s) => {
          const name = s.attributes.friendly_name || '';
          return name.toLowerCase().includes(area.toLowerCase());
        })
        .map((s) => {
          const name: string = s.attributes.friendly_name || '';
          // Plain-text prefix match: a room name is user input, not a pattern.
          const rest = name.slice(area.length);
          const hasAreaPrefix =
            name.toLowerCase().startsWith(area.toLowerCase()) && /^\s/.test(rest);
          return { ...s, displayName: (hasAreaPrefix ? rest : name).trim() };
        });

      const master = areaLights.find((l) => metadata[l.entity_id]?.model === 'Room');
      const floor =
        areaLights.map((l) => metadata[l.entity_id]?.floor).find((f) => !!f) || OTHER_FLOOR;

      return {
        id: area,
        name: area,
        floor,
        isOn: areaLights.some((l) => (getLightState ? getLightState(l) : l.state === 'on')),
        brightness:
          onLights.length > 0
            ? Math.round(
                (onLights.reduce(
                  (acc, l) =>
                    acc +
                    (getLightBrightness ? getLightBrightness(l) : l.attributes.brightness || 0),
                  0,
                ) /
                  onLights.length /
                  255) *
                  100,
              )
            : 0,
        lights: areaLights,
        scenes: areaScenes,
        master,
      };
    });

    const sorted = mapped.sort(
      (a, b) =>
        compareFloors(a.floor, b.floor, floorOrder) ||
        (compareByUserOrder(a.name, b.name, roomOrder) ?? a.name.localeCompare(b.name)),
    );

    return sorted.filter((r) => !isRoomHidden(r.name));
  }, [
    lights,
    scenes,
    metadata,
    getLightState,
    getLightBrightness,
    floorOrder,
    roomOrder,
    isRoomHidden,
  ]);

  const roomsByFloor = useMemo(() => groupByFloor(rooms), [rooms]);

  const activeRoomData = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId),
    [rooms, selectedRoomId],
  );

  const isInteractingRef = useRef(false);
  const lastLocalUpdateRef = useRef(0);
  const isSceneSyncGuardRef = useRef(false);

  useEffect(() => {
    if (!activeRoomData || isInteractingRef.current) return;
    const diff = Math.abs(sliderValue - activeRoomData.brightness);
    const timeSinceLastUpdate = Date.now() - lastLocalUpdateRef.current;
    const guardTime = isSceneSyncGuardRef.current ? 10000 : 2000;
    if (diff > 5 || timeSinceLastUpdate > guardTime) {
      // TODO: [lot 5d de l'audit] remplacer cette synchronisation par un état dérivé (useRoomSlider).

      setSliderValue(activeRoomData.brightness);
    }
  }, [activeRoomData, sliderValue]);

  const chartHistory = useOnOffHistory(
    activeRoomData?.master?.entity_id,
    !!selectedRoomId && showHistory,
  );
  const chartData = chartHistory.data ?? [];
  const chartLoading = chartHistory.isLoading;

  const handleToggleRoom = (room: { isOn: boolean; master?: HAState; lights: HAState[] }) => {
    const newState = !room.isOn;
    if (room.master) onToggle(room.master.entity_id, newState);
    else room.lights.forEach((l) => onToggle(l.entity_id, newState));
  };

  const handleBrightnessChange = (room: { lights: HAState[] }, val: number) => {
    lastLocalUpdateRef.current = Date.now();
    isSceneSyncGuardRef.current = false;
    setSliderValue(val);
    const bri = Math.round((val / 100) * 255);
    room.lights.forEach((l) => {
      const isOn = getLightState ? getLightState(l) : l.state === 'on';
      if (isOn && metadata[l.entity_id]?.model !== 'Room') {
        onSetBrightness(l.entity_id, bri);
      }
    });
  };

  // Counts what the table below shows: a hidden room's lights are left out.
  const activeLightCount = lights
    .filter(isHueLight)
    .filter((l) => !isRoomHidden(metadata[l.entity_id]?.area || 'Autres'))
    .filter(
      (l) =>
        (getLightState ? getLightState(l) : l.state === 'on') &&
        metadata[l.entity_id]?.model !== 'Room',
    ).length;

  return (
    <BaseWidget
      id="lights"
      title={WIDGET_CONFIG.lights.title}
      subtitle={[
        <span key="1">
          <WidgetHighlight colorClass="text-warning">{activeLightCount}</WidgetHighlight> lumière(s)
          allumée(s)
        </span>,
      ]}
      icon={WIDGET_CONFIG.lights.icon}
    >
      {/* Floors side by side once the widget is wide (two section columns on a computer). */}
      <div className="@container">
        <div className="grid grid-cols-1 items-start gap-3 @3xl:grid-cols-2">
          {roomsByFloor.map(({ floor, items: floorRooms }) => (
            <Panel
              key={floor}
              className="overflow-hidden bg-muted p-4"
              data-testid={`light-summary-table-${floor.toLowerCase()}`}
            >
              <div className="mb-3 text-xs font-bold tracking-wider text-primary uppercase">
                {floor}
              </div>
              <div className="overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      <th className="pb-2 pl-3 font-medium">Pièce</th>
                      <th className="pb-2 text-right font-medium">Contrôle</th>
                      <th className="pr-3 pb-2 text-right font-medium">Intensité</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {floorRooms.map((room) => {
                      const isExpanded = selectedRoomId === room.id;
                      const normalizedId = room.id.toLowerCase().replace('light.', '');

                      return (
                        <React.Fragment key={room.id}>
                          <tr
                            data-testid={`light-card-${normalizedId}`}
                            className="group cursor-pointer"
                            {...toggleProps(isExpanded, () =>
                              setSelectedRoomId((prev) => (prev === room.id ? null : room.id)),
                            )}
                          >
                            <td
                              className={cn(
                                'border-b border-border py-2.5 pl-3 font-medium text-foreground transition-all group-hover:rounded-l-xl group-hover:bg-secondary',
                                isExpanded ? 'rounded-l-xl bg-secondary' : '',
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <AreaIcon
                                  area={room.name}
                                  roomIcons={roomIcons}
                                  size={16}
                                  className="text-muted-foreground/75"
                                />
                                <span>{room.name}</span>
                              </div>
                            </td>

                            <td
                              className={cn(
                                'border-b border-border py-2.5 text-right whitespace-nowrap transition-all group-hover:bg-secondary',
                                isExpanded ? 'bg-secondary' : '',
                              )}
                            >
                              <div
                                className="flex items-center justify-end gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <PowerButton
                                  isOn={room.isOn}
                                  className="h-8 w-12"
                                  textClassName="text-[10px]"
                                  data-testid={`light-toggle-${normalizedId}`}
                                  onClick={() => handleToggleRoom(room)}
                                />
                              </div>
                            </td>

                            <td
                              className={cn(
                                // Half of the row at most: a fixed width made the table overflow its tile in a narrow column.
                                'w-1/2 border-b border-border py-2.5 pr-3 pl-6 text-right whitespace-nowrap transition-all group-hover:rounded-r-xl group-hover:bg-secondary',
                                isExpanded ? 'rounded-r-xl bg-secondary' : '',
                              )}
                            >
                              <div
                                className="ml-auto flex w-full max-w-36 items-center justify-end sm:max-w-56"
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <Slider
                                  value={room.isOn ? room.brightness : 0}
                                  disabled={!room.isOn}
                                  onSlidingComplete={(val) => {
                                    handleBrightnessChange(room, val[0]);
                                  }}
                                  className="h-6 w-full"
                                  testID={`light-brightness-${normalizedId}`}
                                />
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={3} className="border-b border-border bg-muted p-4">
                                <div className="flex flex-col gap-4">
                                  {/* Brightness Slider */}
                                  <div>
                                    <div className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                      Luminosité globale ({sliderValue}%)
                                    </div>
                                    <div className="px-1">
                                      <Slider
                                        key={room.id}
                                        value={sliderValue}
                                        onValueChange={(val) => {
                                          isInteractingRef.current = true;
                                          setSliderValue(val[0]);
                                        }}
                                        onSlidingStart={() => {
                                          isInteractingRef.current = true;
                                        }}
                                        onSlidingComplete={(val) => {
                                          isInteractingRef.current = false;
                                          handleBrightnessChange(room, val[0]);
                                        }}
                                        max={100}
                                        step={5}
                                      />
                                    </div>
                                  </div>

                                  {/* Scenes */}
                                  {room.scenes.length > 0 && (
                                    <div>
                                      <div className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                        Scénarios
                                      </div>
                                      <div className="flex flex-row flex-wrap gap-2">
                                        {room.scenes.map((scene) => (
                                          <button
                                            type="button"
                                            key={scene.entity_id}
                                            onClick={() => {
                                              lastLocalUpdateRef.current = Date.now();
                                              isSceneSyncGuardRef.current = true;
                                              onActivateScene?.(
                                                scene.entity_id,
                                                scene.attributes.friendly_name || '',
                                                room.lights.map((l) => l.entity_id),
                                              );
                                            }}
                                            className="rounded-full bg-secondary px-3.5 py-2 transition-colors hover:bg-border"
                                          >
                                            <span className="text-xs font-medium text-foreground">
                                              {scene.displayName}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Individual Lights list */}
                                  {room.lights.length > 0 && (
                                    <div>
                                      <div className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                        Contrôle individuel
                                      </div>
                                      <div className="overflow-hidden">
                                        <table className="w-full border-collapse text-left">
                                          <thead>
                                            <tr className="border-b border-border text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                                              <th className="pb-1.5 pl-3 font-medium">Luminaire</th>
                                              <th className="pb-1.5 text-right font-medium">
                                                Contrôle
                                              </th>
                                              <th className="pr-3 pb-1.5 text-right font-medium">
                                                Intensité
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="text-xs">
                                            {room.lights
                                              .filter(
                                                (light) =>
                                                  metadata[light.entity_id]?.model !== 'Room',
                                              )
                                              .map((light) => {
                                                const isLightOn = getLightState
                                                  ? getLightState(light)
                                                  : light.state === 'on';
                                                const lightBrightness = getLightBrightness
                                                  ? getLightBrightness(light)
                                                  : light.attributes.brightness || 0;
                                                const brightnessPercent = Math.round(
                                                  (lightBrightness / 255) * 100,
                                                );
                                                const name =
                                                  light.attributes.friendly_name || light.entity_id;
                                                const itemNormalizedId = light.entity_id.replace(
                                                  'light.',
                                                  '',
                                                );

                                                return (
                                                  <tr key={light.entity_id} className="group/light">
                                                    <td className="border-b border-border py-2 pl-3 font-medium text-foreground transition-all group-hover/light:rounded-l-lg group-hover/light:bg-secondary">
                                                      <div className="flex flex-col">
                                                        <span className="text-xs leading-tight font-medium">
                                                          {name}
                                                        </span>
                                                      </div>
                                                    </td>

                                                    <td className="border-b border-border py-2 text-right whitespace-nowrap transition-all group-hover/light:bg-secondary">
                                                      <PowerButton
                                                        isOn={isLightOn}
                                                        className="ml-auto h-7 w-11"
                                                        textClassName="text-[9px]"
                                                        data-testid={`light-toggle-${itemNormalizedId}`}
                                                        onClick={() =>
                                                          onToggle(light.entity_id, !isLightOn)
                                                        }
                                                      />
                                                    </td>

                                                    <td className="w-2/5 border-b border-border py-2 pr-3 pl-4 text-right whitespace-nowrap transition-all group-hover/light:rounded-r-lg group-hover/light:bg-secondary">
                                                      <div
                                                        className="ml-auto flex w-full max-w-20 items-center justify-end sm:max-w-28"
                                                        onClick={(e) => e.stopPropagation()}
                                                        onPointerDown={(e) => e.stopPropagation()}
                                                      >
                                                        <Slider
                                                          value={isLightOn ? brightnessPercent : 0}
                                                          disabled={!isLightOn}
                                                          onSlidingComplete={(val) => {
                                                            onSetBrightness(
                                                              light.entity_id,
                                                              Math.round((val[0] / 100) * 255),
                                                            );
                                                          }}
                                                          className="h-5 w-full"
                                                          testID={`light-brightness-${itemNormalizedId}`}
                                                        />
                                                      </div>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}

                                  {/* History chart */}
                                  {showHistory && room.master && (
                                    <div>
                                      <div className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                        Activité (24h)
                                      </div>
                                      <div ref={chartContainerRef}>
                                        {chartLoading ? (
                                          <Skeleton className="h-[28px] w-full rounded-xs" />
                                        ) : (
                                          <TimelineChart
                                            data={chartData}
                                            width={chartWidth || 300}
                                            hours={24}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </BaseWidget>
  );
});
