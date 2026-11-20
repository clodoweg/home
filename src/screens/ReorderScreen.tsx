/**
 * ReorderScreen — Dual-tab drag-and-drop reordering screen.
 *
 * Tab "Widgets" : global widget order + visibility toggle.
 * Tab "Pièces"  : order + visibility of rooms inside the Temperature widget.
 *
 * Both tabs share the same dnd-kit SortableContext pattern and persist via
 * WidgetPreferencesContext (updateOrder / updateRoomOrder / toggleWidgetVisibility / toggleRoomVisibility).
 */
import React, { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LayoutGrid, Thermometer, Sliders, GripVertical, Eye, EyeOff } from 'lucide-react';

import { useWidgetPreferences } from '../context/WidgetPreferencesContext';
import { useUserProfile } from '../context/UserContext';
import { ReorderItem } from '../components/ui/ReorderItem';
import { WIDGET_CONFIG } from '../constants/widgets';
import { getIconForArea, ROOM_ICONS } from '../utils/areaIcons';
import { cn } from '../lib/utils';
import { HAState } from '../services/api';
import { ThresholdsTab } from './reorder/ThresholdsTab';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReorderScreenProps {
  onNavigate: (screen: 'dashboard' | 'reorder') => void;
  /** Live room names and floors derived from HA temperature sensors, used to populate the Rooms tab. */
  availableRooms?: { room: string; floor: string }[];
  sensors?: HAState[];
  metadata?: Record<string, { area: string; floor?: string; model: string }>;
}

type ActiveTab = 'widgets' | 'rooms' | 'thresholds';

interface SortableFloorItemProps {
  floor: string;
  rooms: string[];
  dndSensors: ReturnType<typeof useSensors>;
  onRoomDragEnd: (floor: string, event: DragEndEvent) => void;
  onRoomIconClick?: (room: string) => void;
  haSensors?: HAState[];
  metadata?: Record<string, { area: string; floor?: string; model: string }>;
}

/**
 * Order after a drag-and-drop, or null when the drop changes nothing: dropped on itself, outside
 * any target, or on an item of another list.
 *
 * @param order - Current order.
 * @param event - dnd-kit drop event.
 * @returns The new order, or null.
 */
const reorderAfterDrop = (order: string[], { active, over }: DragEndEvent): string[] | null => {
  if (!over || active.id === over.id) return null;
  const from = order.indexOf(String(active.id));
  const to = order.indexOf(String(over.id));
  if (from === -1 || to === -1) return null;
  return arrayMove(order, from, to);
};

// ─── Sortable Widget Row ──────────────────────────────────────────────────────

const SortableWidgetItem = ({ id }: { id: string }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const { isWidgetHidden, toggleWidgetVisibility } = useWidgetPreferences();

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
    zIndex: isDragging ? 999 : 1,
  };

  const config = WIDGET_CONFIG[id] || WIDGET_CONFIG.lights;

  return (
    <div ref={setNodeRef} style={style}>
      <ReorderItem
        title={config.title}
        icon={config.icon}
        tone={config.tone}
        isActive={isDragging}
        marginBottom={0}
        isVisible={!isWidgetHidden(id)}
        onToggleVisibility={() => toggleWidgetVisibility(id)}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};

// ─── Sortable Room Row ────────────────────────────────────────────────────────

interface SortableRoomItemProps {
  id: string;
  onIconClick?: () => void;
  haSensors?: HAState[];
  metadata?: Record<string, { area: string; floor?: string; model: string }>;
}

const SortableRoomItem = ({
  id,
  onIconClick,
  haSensors = [],
  metadata = {},
}: SortableRoomItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const { isRoomHidden, toggleRoomVisibility, roomIcons, isSensorHidden, toggleSensorVisibility } =
    useWidgetPreferences();

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
    zIndex: isDragging ? 999 : 1,
  };

  const Icon = getIconForArea(id, roomIcons);

  const roomTempSensors = useMemo(() => {
    return haSensors.filter((s) => {
      const dc = s.attributes.device_class;
      return dc === 'temperature' && (metadata[s.entity_id]?.area || 'Autres') === id;
    });
  }, [haSensors, metadata, id]);

  return (
    <div ref={setNodeRef} style={style} data-testid={`room-item-${id}`}>
      <ReorderItem
        title={id}
        icon={Icon}
        isActive={isDragging}
        marginBottom={0}
        isVisible={!isRoomHidden(id)}
        onToggleVisibility={() => toggleRoomVisibility(id)}
        onIconClick={onIconClick}
        dragHandleProps={{ ...attributes, ...listeners }}
      >
        {roomTempSensors.length > 0 && !isRoomHidden(id) && (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-3">
            <div className="mb-1 text-[10px] font-bold tracking-wider text-muted-foreground/70 uppercase">
              Capteurs de température
            </div>
            <div className="flex max-h-[180px] flex-col gap-1 overflow-y-auto pr-1">
              {roomTempSensors.map((sensor) => {
                const isHidden = isSensorHidden(sensor.entity_id);
                const name = sensor.attributes.friendly_name || sensor.entity_id;
                const model = metadata[sensor.entity_id]?.model;

                // Clean name: remove "Température" or "Temperature" and room name to keep it short
                let cleanName = name
                  .replace(new RegExp(`température`, 'gi'), '')
                  .replace(new RegExp(`temperature`, 'gi'), '')
                  .replace(new RegExp(id, 'gi'), '')
                  .trim();
                if (cleanName) {
                  cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
                }

                let displayModel = model;
                if (model?.toLowerCase() === 'sensor') {
                  displayModel = 'Capteur';
                }
                const label = cleanName || displayModel || 'Capteur';

                return (
                  <div
                    key={sensor.entity_id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5 transition-colors',
                      isHidden ? 'bg-background opacity-60' : 'bg-background',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {label}
                      </span>
                      <span className="truncate font-mono text-[9px] text-muted-foreground">
                        {sensor.entity_id}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSensorVisibility(sensor.entity_id)}
                      className="shrink-0 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      aria-label={isHidden ? `Afficher ${label}` : `Masquer ${label}`}
                    >
                      {isHidden ? (
                        <EyeOff size={14} className="text-muted-foreground/40" />
                      ) : (
                        <Eye size={14} className="text-primary" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ReorderItem>
    </div>
  );
};

// ─── Sortable Floor Item ──────────────────────────────────────────────────────

const SortableFloorItem = ({
  floor,
  rooms,
  dndSensors,
  onRoomDragEnd,
  onRoomIconClick,
  haSensors = [],
  metadata = {},
}: SortableFloorItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: floor,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-6 rounded-2xl bg-muted p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-grab touch-none rounded-md p-1.5 hover:bg-secondary"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={20} className="text-muted-foreground opacity-50" />
          </button>
          <h4 className="text-sm font-bold tracking-wider text-primary uppercase">{floor}</h4>
        </div>
      </div>

      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => onRoomDragEnd(floor, e)}
      >
        <SortableContext items={rooms} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {rooms.map((room) => (
              <SortableRoomItem
                key={room}
                id={room}
                onIconClick={onRoomIconClick ? () => onRoomIconClick(room) : undefined}
                haSensors={haSensors}
                metadata={metadata}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

/**
 * Customization screen: widget order and visibility, rooms per floor, thresholds.
 *
 * @param props - Navigation callback and the rooms, sensors and metadata from Home Assistant.
 * @returns The screen.
 */
export const ReorderScreen = ({
  onNavigate: _onNavigate,
  availableRooms = [],
  sensors: haSensors = [],
  metadata = {},
}: ReorderScreenProps) => {
  const {
    widgetOrder,
    updateOrder,
    roomOrder,
    updateRoomOrder,
    floorOrder,
    updateFloorOrder,
    roomIcons,
    updateRoomIcon,
  } = useWidgetPreferences();
  const { canAccessHistory, canAccessCameras } = useUserProfile();

  const [activeTab, setActiveTab] = useState<ActiveTab>('widgets');
  const [iconPickerRoom, setIconPickerRoom] = useState<string | null>(null);

  // ── Widget order state ──────────────────────────────────────────────────────

  const filteredWidgetOrder = useMemo(() => {
    // Widgets hidden by permissions are not shown in the reorder list at all.
    const permHiddenWidgets = [
      ...(!canAccessHistory ? ['electricity', 'gas', 'water'] : []),
      ...(!canAccessCameras ? ['arlo'] : []),
    ];
    return widgetOrder.filter((id) => !permHiddenWidgets.includes(id));
  }, [widgetOrder, canAccessHistory, canAccessCameras]);

  const [currentWidgetOrder, setCurrentWidgetOrder] = useState<string[]>([]);
  if (filteredWidgetOrder.length > 0 && currentWidgetOrder.length === 0) {
    setCurrentWidgetOrder(filteredWidgetOrder);
  }

  // ── Floor & Room order state ────────────────────────────────────────────────

  const initialFloorOrder = useMemo(() => {
    const floors = Array.from(new Set(availableRooms.map((r) => r.floor || 'Autres')));
    if (floors.length === 0) return floorOrder;
    const saved = floorOrder.filter((f) => floors.includes(f));
    const newFloors = floors
      .filter((f) => !floorOrder.includes(f))
      .sort((a, b) => a.localeCompare(b));
    return [...saved, ...newFloors];
  }, [floorOrder, availableRooms]);

  const [currentFloorOrder, setCurrentFloorOrder] = useState<string[]>([]);
  if (initialFloorOrder.length > 0 && currentFloorOrder.length === 0) {
    setCurrentFloorOrder(initialFloorOrder);
  }

  const initialRoomOrder = useMemo(() => {
    const roomNames = availableRooms.map((r) => r.room);
    if (roomNames.length === 0) return roomOrder;
    const saved = roomOrder.filter((r) => roomNames.includes(r));
    const newRooms = roomNames
      .filter((r) => !roomOrder.includes(r))
      .sort((a, b) => a.localeCompare(b));
    return [...saved, ...newRooms];
  }, [roomOrder, availableRooms]);

  const [currentRoomOrder, setCurrentRoomOrder] = useState<string[]>([]);
  if (initialRoomOrder.length > 0 && currentRoomOrder.length === 0) {
    setCurrentRoomOrder(initialRoomOrder);
  }

  // ── dnd-kit sensors (shared) ────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleWidgetDragEnd = (event: DragEndEvent) => {
    const newOrder = reorderAfterDrop(currentWidgetOrder, event);
    if (!newOrder) return;
    setCurrentWidgetOrder(newOrder);
    updateOrder(newOrder);
  };

  const handleFloorDragEnd = (event: DragEndEvent) => {
    const newOrder = reorderAfterDrop(currentFloorOrder, event);
    if (!newOrder) return;
    setCurrentFloorOrder(newOrder);
    updateFloorOrder(newOrder);
  };

  const handleRoomDragEndForFloor = (floor: string, event: DragEndEvent) => {
    const floorRoomNames = availableRooms
      .filter((ar) => (ar.floor || 'Autres') === floor)
      .map((ar) => ar.room);
    const roomsOfThisFloor = currentRoomOrder.filter((r) => floorRoomNames.includes(r));
    const newRoomsOrder = reorderAfterDrop(roomsOfThisFloor, event);
    if (!newRoomsOrder) return;

    // The floor's rooms take back their place in the global order, at the first one's position.
    const firstIndex = currentRoomOrder.findIndex((r) => roomsOfThisFloor.includes(r));
    const cleanGlobal = currentRoomOrder.filter((r) => !roomsOfThisFloor.includes(r));
    cleanGlobal.splice(firstIndex, 0, ...newRoomsOrder);
    setCurrentRoomOrder(cleanGlobal);
    updateRoomOrder(cleanGlobal);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-h-[80vh] w-full max-w-[1624px] flex-1 overflow-y-auto px-6 pb-10">
      {/* ── Tab bar ── */}
      <div
        className="mb-4 flex gap-1 rounded-xl bg-muted p-1"
        role="tablist"
        aria-label="Sections de réorganisation"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'widgets'}
          data-testid="reorder-tab-widgets"
          onClick={() => setActiveTab('widgets')}
          className={[
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-all duration-200',
            activeTab === 'widgets'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          <LayoutGrid size={14} />
          Widgets
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'rooms'}
          data-testid="reorder-tab-rooms"
          onClick={() => setActiveTab('rooms')}
          className={[
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-all duration-200',
            activeTab === 'rooms'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          <Thermometer size={14} />
          Pièces
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'thresholds'}
          data-testid="reorder-tab-thresholds"
          onClick={() => setActiveTab('thresholds')}
          className={[
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[11px] font-bold tracking-widest uppercase transition-all duration-200',
            activeTab === 'thresholds'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          <Sliders size={14} />
          Seuils
        </button>
      </div>

      {/* ── Widgets tab ── */}
      {activeTab === 'widgets' && (
        <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-x-4 gap-y-[5px]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleWidgetDragEnd}
          >
            <SortableContext items={currentWidgetOrder} strategy={rectSortingStrategy}>
              {currentWidgetOrder.map((id) => (
                <SortableWidgetItem key={id} id={id} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* ── Rooms tab ── */}
      {activeTab === 'rooms' && (
        <div className="w-full">
          {currentRoomOrder.length === 0 ? (
            <p className="py-8 text-center text-[11px] tracking-widest text-muted-foreground uppercase">
              Aucune pièce détectée — ouvrez le widget Température pour charger les données.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleFloorDragEnd}
            >
              <SortableContext items={currentFloorOrder} strategy={verticalListSortingStrategy}>
                {currentFloorOrder.map((floor) => {
                  const floorRooms = currentRoomOrder.filter((r) => {
                    const info = availableRooms.find((ar) => ar.room === r);
                    return (info?.floor || 'Autres') === floor;
                  });
                  return (
                    <SortableFloorItem
                      key={floor}
                      floor={floor}
                      rooms={floorRooms}
                      dndSensors={sensors}
                      onRoomDragEnd={handleRoomDragEndForFloor}
                      onRoomIconClick={setIconPickerRoom}
                      haSensors={haSensors}
                      metadata={metadata}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {activeTab === 'thresholds' && <ThresholdsTab />}
      {/* ── Icon Picker Modal ── */}
      {iconPickerRoom && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-background/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card/90 p-6 shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">
                Choisir une icône pour <span className="text-primary">{iconPickerRoom}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIconPickerRoom(null)}
                className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Fermer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="grid flex-1 grid-cols-4 gap-3 overflow-y-auto py-2 pr-1">
              {Object.entries(ROOM_ICONS).map(([iconKey, { icon: Icon, label }]) => {
                const activeIcon = roomIcons[iconPickerRoom] || '';
                const currentFallbackIcon = getIconForArea(iconPickerRoom);
                const isSelected =
                  activeIcon === iconKey || (!activeIcon && Icon === currentFallbackIcon);

                return (
                  <button
                    key={iconKey}
                    type="button"
                    title={label}
                    onClick={() => {
                      updateRoomIcon(iconPickerRoom, iconKey);
                      setIconPickerRoom(null);
                    }}
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all duration-200 hover:scale-105 active:scale-95',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-transparent bg-muted text-muted-foreground hover:border-primary/30 hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    <Icon size={24} />
                    <span className="w-full truncate text-center text-[10px] font-medium">
                      {label.split(' (')[0] || label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  updateRoomIcon(iconPickerRoom, '');
                  setIconPickerRoom(null);
                }}
                className="cursor-pointer rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                Réinitialiser par défaut
              </button>
              <button
                type="button"
                onClick={() => setIconPickerRoom(null)}
                className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/95"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
