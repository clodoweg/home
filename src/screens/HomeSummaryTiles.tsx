/**
 * HomeSummaryTiles — The wide tiles opening the home screen, above the per-widget tiles: "today"
 * (date, weather, outdoor and living-room temperature, forecast), "lights" (what is on, a
 * switch per room, everything on or off), "pets" (feeder, fountain, a ration on demand) and
 * "devices" (spa, washing machine, 3D printer) and "security" (alarm switch, camera pictures); "energy" lives in EnergySummaryTile. Each takes the full width of a phone and half of a
 * computer screen.
 */
import React, { useMemo } from 'react';
import { format, isSameDay, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowUpRight,
  Camera,
  Cat,
  Droplet,
  Droplets,
  Lightbulb,
  LightbulbOff,
  Lock,
  ShieldCheck,
  ShieldOff,
  Sofa,
  Unlock,
  Utensils,
  Wind,
} from 'lucide-react';

import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { getWeatherIcon } from '../components/ui/WeatherIcon';
import { SecureImage } from '../components/ui/SecureImage';
import { useHAState } from '../hooks/useHAState';
import { cameraImageUrl, type ArloCamera } from '../lib/arlo';
import { useWidgetPreferences } from '../context/WidgetPreferencesContext';
import { useUserProfile } from '../context/UserContext';
import { findPetkitDevice, isFeedEvent, mergeRecords } from '../hooks/petkit/feeder-records';
import { useFeederDailyTotals } from '../hooks/petkit/useFeederDailyTotals';
import { useFountainDay } from '../hooks/petkit/useFountainDay';
import { useOptimisticFeed } from '../hooks/petkit/useOptimisticFeed';
import { useWeatherForecast } from '../hooks/useWeatherForecast';
import { widgetHref } from '../constants/sections';
import { WIDGET_CONFIG } from '../constants/widgets';
import { formatMinutes } from '../lib/format';
import type { HomeSummary } from '../lib/home-summary';
import { alarmStatusLabel, translateCondition } from '../lib/labels';
import { isOutdoorFloor } from '../lib/floors';
import { listTemperatureSensors } from '../lib/temperature-sensors';
import { cn } from '../lib/utils';
import type { HAState, PetKitData } from '../services/api';
import type { IconComponent } from '../types/icon';

const SUMMARY_TILE =
  'col-span-2 flex flex-col justify-between gap-5 rounded-tile p-5 md:col-span-3 md:p-6 xl:col-span-1';

const formatDegrees = (value: number, decimals = 1) =>
  `${value.toLocaleString('fr-FR', { maximumFractionDigits: decimals })}°`;

const greeting = (hour: number) =>
  hour >= 5 && hour < 12 ? 'Bonjour' : hour >= 12 && hour < 18 ? 'Bon après-midi' : 'Bonsoir';

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one);

/** A labelled figure of the "today" tile (living room, humidity, wind…). */
const Fact = ({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent;
  label: string;
  value: string;
}) => (
  <span className="flex min-w-0 flex-row items-center gap-2.5 rounded-2xl bg-white/10 px-3 py-2.5">
    <Icon size={18} aria-hidden="true" className="shrink-0 text-white/80" />
    <span className="min-w-0">
      <span className="block truncate text-xs text-white/80">{label}</span>
      <span className="block font-display text-lg leading-tight font-bold">{value}</span>
    </span>
  </span>
);

/** Next days of the forecast: weekday, condition, high and low. */
const ForecastStrip = ({ entity, today }: { entity: HAState; today: Date }) => {
  const { data: forecast = [] } = useWeatherForecast(entity, 'daily');
  const days = forecast.slice(0, 5);
  if (days.length === 0) return null;

  return (
    <span data-testid="home-forecast" className="grid auto-cols-fr grid-flow-col gap-2">
      {days.map((day) => {
        const date = new Date(day.datetime);
        return (
          <span
            key={day.datetime}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/10 px-1 py-2.5"
          >
            <span className="text-xs font-medium text-white/80 capitalize">
              {isSameDay(date, today) ? 'Auj.' : format(date, 'EEE', { locale: fr })}
            </span>
            {getWeatherIcon(day.condition, 22, true)}
            <span className="text-sm font-semibold">
              {day.temperature !== undefined ? formatDegrees(day.temperature, 0) : '–'}
              {day.templow !== undefined && (
                <span className="font-normal text-white/80"> {formatDegrees(day.templow, 0)}</span>
              )}
            </span>
          </span>
        );
      })}
    </span>
  );
};

interface TodayTileProps {
  now: Date;
  firstName?: string | null;
  /** Current weather, or null when the weather widget is hidden or has no data. */
  weather: HomeSummary['weather'];
  /** Weather entity, for the forecast. */
  weatherEntity?: HAState;
  /** Sensor entities and area metadata, to read the living room; empty when the temperature widget is hidden. */
  sensors: HAState[];
  metadata: Record<string, { area: string; floor?: string; model: string }>;
}

/**
 * "Today" tile: date and greeting, current weather with the outdoor temperature (the visible
 * sensor of an outdoor floor or room, else the weather service's), the living room (first visible
 * indoor sensor when no room is called "Salon") and the forecast of the next days.
 *
 * @param props - Clock, first name, weather and the temperature sensors.
 * @returns The tile.
 */
export const TodayTile = ({
  now,
  firstName,
  weather,
  weatherEntity,
  sensors,
  metadata,
}: TodayTileProps) => {
  const { isSensorHidden, isRoomHidden, roomOrder, floorOrder } = useWidgetPreferences();
  const { indoor, outdoor } = useMemo(() => {
    const rows = listTemperatureSensors({
      data: sensors,
      metadata,
      isSensorHidden,
      isRoomHidden,
      roomOrder,
      floorOrder,
    });
    const isOutdoor = (row: (typeof rows)[number]) =>
      isOutdoorFloor(row.floor) || isOutdoorFloor(row.area);
    const inside = rows.filter((row) => !isOutdoor(row));
    return {
      indoor: inside.find((row) => row.area.toLowerCase() === 'salon') ?? inside[0] ?? null,
      outdoor: rows.find(isOutdoor) ?? null,
    };
  }, [sensors, metadata, isSensorHidden, isRoomHidden, roomOrder, floorOrder]);
  // The house's own outdoor sensor beats the weather service's estimate.
  const outdoorTemp = outdoor?.temp ?? weather?.temperature ?? null;

  return (
    <section data-testid="home-summary-today" className={cn(SUMMARY_TILE, 'bg-cobalt text-white')}>
      <div className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/80 first-letter:uppercase">
            {format(now, 'EEEE d MMMM', { locale: fr })}
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight font-bold tracking-tight md:text-4xl">
            {greeting(now.getHours())}
            {firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        {weather && (
          <a
            href={widgetHref('weather')}
            aria-label="Voir la météo"
            className="flex shrink-0 flex-row items-center gap-3 rounded-2xl focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-hidden"
          >
            {getWeatherIcon(weather.condition, 44, true)}
            <span className="text-right">
              <span
                data-testid="home-outdoor-temp"
                className="block font-display text-5xl leading-none font-bold tracking-tight md:text-6xl"
              >
                {outdoorTemp !== null ? formatDegrees(outdoorTemp) : '—'}
              </span>
              <span className="mt-1 block text-sm text-white/80">
                Dehors · {translateCondition(weather.condition)}
              </span>
            </span>
          </a>
        )}
      </div>

      {(indoor || weather) && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {indoor && <Fact icon={Sofa} label={indoor.name} value={formatDegrees(indoor.temp)} />}
          {indoor?.humidity != null && (
            <Fact
              icon={Droplets}
              label={`Humidité ${indoor.name}`}
              value={`${indoor.humidity} %`}
            />
          )}
          {weather?.windSpeed != null && (
            <Fact icon={Wind} label="Vent" value={`${Math.round(weather.windSpeed)} km/h`} />
          )}
          {weather?.humidity != null && (
            <Fact
              icon={Droplet}
              label="Humidité dehors"
              value={`${Math.round(weather.humidity)} %`}
            />
          )}
        </div>
      )}

      {weather && weatherEntity && <ForecastStrip entity={weatherEntity} today={now} />}
    </section>
  );
};

interface LightsSummaryTileProps {
  lights: HomeSummary['lights'];
  /** Toggles each of the given lights (or room groups). */
  onToggleLights: (entityIds: string[]) => void;
}

/**
 * "Lights" tile: how many lights are on, a switch per room, and everything on or off.
 *
 * @param props - Lights summary and the toggle action.
 * @returns The tile.
 */
export const LightsSummaryTile = ({ lights, onToggleLights }: LightsSummaryTileProps) => {
  const rooms = lights.roomList;
  const allOnIds = rooms.flatMap((room) => room.turnOnIds);
  const allOffIds = rooms.flatMap((room) => room.turnOffIds);
  const litRooms = rooms.filter((room) => room.on).length;

  return (
    <section data-testid="home-summary-lights" className={cn(SUMMARY_TILE, 'bg-sun text-ink')}>
      <div className="flex flex-row items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Lumières</p>
          <p className="mt-2 flex flex-row items-baseline gap-3">
            <span className="font-display text-6xl leading-none font-bold tracking-tight md:text-7xl">
              {lights.on}
            </span>
            <span className="text-sm font-medium">
              {plural(lights.on, 'allumée', 'allumées')} sur {lights.total}
              <br />
              {litRooms > 0
                ? `dans ${litRooms} ${plural(litRooms, 'pièce', 'pièces')}`
                : 'tout est éteint'}
            </span>
          </p>
        </div>
        <a
          href={widgetHref('lights')}
          aria-label="Ouvrir les lumières"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-sun focus-visible:outline-hidden"
        >
          <ArrowUpRight size={20} aria-hidden="true" />
        </a>
      </div>

      {rooms.length > 0 && (
        <div className="flex flex-row flex-wrap gap-2">
          {rooms.map((room) => (
            <button
              key={room.name}
              type="button"
              data-testid={`home-light-room-${room.name}`}
              aria-pressed={room.on}
              aria-label={`${room.on ? 'Éteindre' : 'Allumer'} ${room.name}`}
              onClick={() => onToggleLights(room.on ? room.turnOffIds : room.turnOnIds)}
              className={cn(
                'flex h-11 flex-row items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-sun focus-visible:outline-hidden',
                room.on ? 'bg-ink text-white' : 'bg-ink/10 text-ink hover:bg-ink/20',
              )}
            >
              {room.on ? (
                <Lightbulb size={16} aria-hidden="true" />
              ) : (
                <LightbulbOff size={16} aria-hidden="true" className="opacity-60" />
              )}
              {room.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button
          data-testid="home-lights-on"
          label="Tout allumer"
          icon={Lightbulb}
          disabled={allOnIds.length === 0}
          onClick={() => onToggleLights(allOnIds)}
          className="bg-ink text-white hover:bg-ink/90 active:bg-ink/80"
        />
        <Button
          data-testid="home-lights-off"
          label="Tout éteindre"
          icon={LightbulbOff}
          disabled={allOffIds.length === 0}
          onClick={() => onToggleLights(allOffIds)}
          className="bg-white text-ink hover:bg-white/90 active:bg-white/80"
        />
      </div>
    </section>
  );
};

/** Food level of a feeder bowl: 0 empty, 1 low, 2 ok (as in the feeder widget). */
const BOWL_LEVEL: Record<number, string> = { 0: 'vide', 1: 'faible', 2: 'ok' };

/** A device block of the "pets" tile: title, big figure, caption, details. */
const PetBlock = ({
  widgetId,
  icon: Icon,
  title,
  figure,
  caption,
  children,
}: {
  /** Widget the block opens. */
  widgetId: string;
  icon: IconComponent;
  title: string;
  figure: React.ReactNode;
  caption: string;
  children?: React.ReactNode;
}) => (
  <a
    href={widgetHref(widgetId)}
    data-testid={`home-pet-${widgetId}`}
    className="flex min-w-0 flex-col gap-3 rounded-2xl bg-ink/10 p-4 transition-transform focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-hidden active:scale-[0.99]"
  >
    <p className="flex flex-row items-center gap-2 text-sm font-semibold">
      <Icon size={18} aria-hidden="true" className="shrink-0" />
      {title}
    </p>
    <p>
      <span className="block font-display text-5xl leading-none font-bold tracking-tight">
        {figure}
      </span>
      <span className="mt-1.5 block text-sm font-medium">{caption}</span>
    </p>
    {children}
  </a>
);

interface PetsSummaryTileProps {
  petkit: PetKitData | null;
  /** Whether the feeder and fountain widgets are visible to the user. */
  showFeeder: boolean;
  showFountain: boolean;
  /** Petkit has not answered yet: the tile keeps its place with a placeholder. */
  loading?: boolean;
  now: Date;
}

/**
 * "Pets" tile: the feeder (rations of the day against the plan, last meal, bowl levels), the
 * fountain (visits of the day, water level, filter) and a button serving one ration in a single
 * tap, as in the feeder widget.
 *
 * @param props - Petkit data, which devices to show and the clock.
 * @returns The tile, or nothing when neither device is shown.
 */
export const PetsSummaryTile = ({
  petkit,
  showFeeder,
  showFountain,
  loading = false,
  now,
}: PetsSummaryTileProps) => {
  const { token } = useUserProfile();
  const feeder = useMemo(
    () => (showFeeder ? findPetkitDevice(petkit?.devices, ['d4', 'feeder']) : undefined),
    [petkit?.devices, showFeeder],
  );
  const fountain = useMemo(
    () => (showFountain ? findPetkitDevice(petkit?.devices, ['ctw', 'fountain']) : undefined),
    [petkit?.devices, showFountain],
  );

  const { pendingFeedings, isFeeding, handleFeed } = useOptimisticFeed({
    device: feeder,
    token,
    data: petkit,
  });
  const { todayTotalRations, todayPlanTotal, yesterdayTotalRations } = useFeederDailyTotals({
    data: petkit,
    device: feeder,
    pendingFeedings,
  });

  const todayStart = startOfDay(now).getTime();
  const today = useMemo(() => new Date(todayStart), [todayStart]);
  const { activity, waterLevelStatus, filterLife } = useFountainDay(petkit, fountain, today);

  const lastMeal = useMemo(() => {
    const meals = mergeRecords(pendingFeedings, petkit?.records ?? [])
      .filter(isFeedEvent)
      .filter((record) => record.time * 1000 >= todayStart);
    return meals.length > 0 ? Math.max(...meals.map((record) => record.time)) * 1000 : null;
  }, [pendingFeedings, petkit?.records, todayStart]);

  // The dashboard no longer waits for the (often slow) Petkit cloud: until it answers, the tile
  // holds its place with the shape of its content.
  if (loading && !petkit && (showFeeder || showFountain)) {
    return (
      <section
        data-testid="home-summary-pets-loading"
        aria-busy="true"
        aria-label="Animaux en cours de chargement"
        className={cn(SUMMARY_TILE, 'bg-tangerine text-ink')}
      >
        <p className="text-sm font-semibold">Animaux</p>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-40 rounded-2xl bg-ink/10" />
          <Skeleton className="h-40 rounded-2xl bg-ink/10" />
        </div>
        <Skeleton className="h-11 rounded-full bg-ink/10" />
      </section>
    );
  }

  if (!feeder && !fountain) return null;

  const bowls = [feeder?.status?.food1, feeder?.status?.food2]
    .map((level, index) =>
      level !== undefined && BOWL_LEVEL[level] ? `Bac ${index + 1} ${BOWL_LEVEL[level]}` : null,
    )
    .filter(Boolean);

  return (
    <section data-testid="home-summary-pets" className={cn(SUMMARY_TILE, 'bg-tangerine text-ink')}>
      <div className="flex flex-row items-center justify-between gap-4">
        <p className="text-sm font-semibold">Animaux</p>
        <a
          href={widgetHref('feeder', 'fountain')}
          aria-label="Ouvrir les animaux"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-tangerine focus-visible:outline-hidden"
        >
          <ArrowUpRight size={20} aria-hidden="true" />
        </a>
      </div>

      <div className={cn('grid gap-2', feeder && fountain ? 'grid-cols-2' : 'grid-cols-1')}>
        {feeder && (
          <PetBlock
            widgetId="feeder"
            icon={Cat}
            title="Croquettes"
            figure={
              <>
                {todayTotalRations}
                {todayPlanTotal > 0 && <span className="text-2xl"> / {todayPlanTotal}</span>}
              </>
            }
            caption={`${plural(todayTotalRations, 'ration', 'rations')} aujourd'hui`}
          >
            {todayPlanTotal > 0 && (
              <span className="block h-2 overflow-hidden rounded-full bg-ink/20">
                <span
                  className="block h-full rounded-full bg-ink"
                  style={{ width: `${Math.min(100, (todayTotalRations / todayPlanTotal) * 100)}%` }}
                />
              </span>
            )}
            <p className="text-xs font-medium">
              {lastMeal
                ? `Dernier repas ${format(lastMeal, 'HH:mm')}`
                : "Pas encore de repas aujourd'hui"}
              {' · '}hier {yesterdayTotalRations}
              {bowls.length > 0 && (
                <>
                  <br />
                  {bowls.join(' · ')}
                </>
              )}
            </p>
          </PetBlock>
        )}
        {fountain && (
          <PetBlock
            widgetId="fountain"
            icon={Droplets}
            title="Fontaine"
            figure={activity.total}
            caption={`${plural(activity.total, 'passage', 'passages')} aujourd'hui`}
          >
            <span className="block h-2 overflow-hidden rounded-full bg-ink/20">
              <span
                className="block h-full rounded-full bg-ink"
                style={{ width: `${Math.min(100, Math.max(0, filterLife))}%` }}
              />
            </span>
            <p className="text-xs font-medium">
              Filtre {filterLife} %
              <br />
              {waterLevelStatus === 0 ? "Niveau d'eau normal" : "Niveau d'eau bas"}
            </p>
          </PetBlock>
        )}
      </div>

      {feeder && (
        <Button
          data-testid="home-feed"
          label="Donner une ration"
          icon={Utensils}
          loading={isFeeding}
          onClick={() => void handleFeed()}
          className="w-full bg-ink text-white hover:bg-ink/90 active:bg-ink/80"
        />
      )}
    </section>
  );
};

const WASHER_PHASE_LABEL = {
  running: 'En cours',
  paused: 'En pause',
  finished: 'Terminé',
  off: 'Arrêt',
} as const;

/** One device of the "devices" tile: icon, name and state on the left, its key figure on the right. */
const DeviceRow = ({
  id,
  value,
  status,
  percent,
  children,
}: {
  /** Widget id: gives the row its name and icon. */
  id: string;
  value: string;
  status: React.ReactNode;
  /** Progress bar under the row (heating, printing), when there is one. */
  percent?: number;
  children?: React.ReactNode;
}) => {
  const { title, icon: Icon } = WIDGET_CONFIG[id];
  return (
    <a
      href={widgetHref(id)}
      data-testid={`home-device-${id}`}
      className="flex flex-col gap-3 rounded-2xl bg-ink/10 p-4 transition-transform focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-hidden active:scale-[0.99]"
    >
      <div className="flex flex-row items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs font-medium">{status}</span>
        </span>
        <span className="shrink-0 font-display text-2xl leading-none font-bold tracking-tight md:text-3xl">
          {value}
        </span>
      </div>
      {percent !== undefined && (
        <span className="block h-2 overflow-hidden rounded-full bg-ink/20">
          <span
            className="block h-full rounded-full bg-ink"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </span>
      )}
      {children}
    </a>
  );
};

/** On/off state of a spa function, as a small pill. */
const StatePill = ({ label, on }: { label: string; on: boolean }) => (
  <span
    className={cn(
      'rounded-full px-2.5 py-1 text-xs font-semibold',
      on ? 'bg-ink text-white' : 'bg-ink/10 opacity-70',
    )}
  >
    {label}
  </span>
);

interface DevicesSummaryTileProps {
  spa: HomeSummary['spa'];
  washer: HomeSummary['washer'];
  printer: HomeSummary['printer'];
  /** Whether each device's widget is visible to the user. */
  showSpa: boolean;
  showWasher: boolean;
  showPrinter: boolean;
}

/**
 * "Devices" tile: the spa (temperature, heating, pump, filtration, bubbles), the washing machine
 * (time left or state, programme) and the 3D printer (progress, time left, file). A device whose
 * widget is shown but which reports nothing reads « Indisponible », as on its own tile.
 *
 * @param props - Device summaries and which widgets are visible.
 * @returns The tile, or nothing when none of the three widgets is visible.
 */
export const DevicesSummaryTile = ({
  spa,
  washer,
  printer,
  showSpa,
  showWasher,
  showPrinter,
}: DevicesSummaryTileProps) => {
  if (!showSpa && !showWasher && !showPrinter) return null;

  const running = [
    showSpa && spa?.power === true,
    showWasher && (washer?.phase === 'running' || washer?.phase === 'paused'),
    showPrinter && printer?.active,
  ].filter(Boolean).length;

  return (
    <section data-testid="home-summary-devices" className={cn(SUMMARY_TILE, 'bg-aqua text-ink')}>
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Appareils</p>
          <p className="mt-0.5 text-xs font-medium">
            {running > 0 ? `${running} en marche` : 'Tout est à l’arrêt'}
          </p>
        </div>
        <a
          href={widgetHref('spa', 'washing_machine', 'bambu_lab')}
          aria-label="Ouvrir les appareils"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-aqua focus-visible:outline-hidden"
        >
          <ArrowUpRight size={20} aria-hidden="true" />
        </a>
      </div>

      <div className="flex flex-col gap-2">
        {showSpa &&
          (spa ? (
            <DeviceRow
              id="spa"
              value={formatDegrees(spa.current)}
              status={
                spa.hasError
                  ? 'Erreur signalée'
                  : spa.heating && spa.target !== null
                    ? `Chauffe vers ${formatDegrees(spa.target)}`
                    : 'Chauffage arrêté'
              }
              percent={
                spa.heating && spa.target !== null && spa.target > 0
                  ? (spa.current / spa.target) * 100
                  : undefined
              }
            >
              <span className="flex flex-row flex-wrap gap-1.5">
                {spa.power !== null && (
                  <StatePill label={spa.power ? 'Marche' : 'Arrêt'} on={spa.power} />
                )}
                {spa.filter !== null && <StatePill label="Filtration" on={spa.filter} />}
                {spa.bubbles !== null && <StatePill label="Bulles" on={spa.bubbles} />}
                {spa.connectionDown && <StatePill label="Connexion coupée" on />}
              </span>
            </DeviceRow>
          ) : (
            <DeviceRow id="spa" value="—" status="Indisponible" />
          ))}

        {showWasher &&
          (washer ? (
            <DeviceRow
              id="washing_machine"
              value={
                (washer.phase === 'running' || washer.phase === 'paused') &&
                washer.remainingMinutes > 0
                  ? formatMinutes(washer.remainingMinutes)
                  : WASHER_PHASE_LABEL[washer.phase]
              }
              status={
                washer.phase === 'off'
                  ? 'À l’arrêt'
                  : [WASHER_PHASE_LABEL[washer.phase], washer.program].filter(Boolean).join(' · ')
              }
            />
          ) : (
            <DeviceRow id="washing_machine" value="—" status="Indisponible" />
          ))}

        {showPrinter &&
          (printer ? (
            <DeviceRow
              id="bambu_lab"
              value={printer.active ? `${Math.round(printer.progress)} %` : printer.statusLabel}
              status={
                printer.active
                  ? [
                      printer.remainingMinutes > 0
                        ? `${formatMinutes(printer.remainingMinutes)} restantes`
                        : printer.statusLabel,
                      printer.filename,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Aucune impression'
              }
              percent={printer.active ? printer.progress : undefined}
            />
          ) : (
            <DeviceRow id="bambu_lab" value="—" status="Indisponible" />
          ))}
      </div>
    </section>
  );
};

interface SecuritySummaryTileProps {
  /** Alarm panel, or undefined when its widget is hidden or the house has none. */
  alarm: HAState | undefined;
  /** Cameras to show, empty when their widget is hidden (camera right) or there is none. */
  cameras: ArloCamera[];
}

/**
 * "Security" tile: the alarm state, on a solid ink band when armed and a dashed outline when disarmed, with a
 * button arming it (away) or disarming it, and the latest
 * picture of each camera, with its motion and connection state. The pictures are the last ones
 * Home Assistant holds: the tile takes no new snapshot (the cameras widget does, when opened).
 *
 * @param props - Alarm panel and cameras.
 * @returns The tile, or nothing without alarm nor camera.
 */
export const SecuritySummaryTile = ({ alarm, cameras }: SecuritySummaryTileProps) => {
  const { loading, getEffectiveValue, performAction } = useHAState();
  if (!alarm && cameras.length === 0) return null;

  const state = alarm ? (getEffectiveValue(alarm) as string) || alarm.state : null;
  const isArmed = !!state && state !== 'disarmed';
  const isTriggered = state === 'triggered';
  const unusable = state === 'unavailable' || state === 'unknown';
  const motion = cameras.filter((cam) => cam.motionEntity?.state === 'on').length;

  const toggleAlarm = () => {
    if (!alarm) return;
    if (isArmed) performAction(alarm, 'alarm_control_panel', 'alarm_disarm', {}, 'disarmed');
    else performAction(alarm, 'alarm_control_panel', 'alarm_arm_away', {}, 'armed_away');
  };

  return (
    <section
      data-testid="home-summary-security"
      className={cn(SUMMARY_TILE, 'justify-start bg-coral text-ink')}
    >
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Sécurité</p>
          {cameras.length > 0 && (
            <p className="mt-0.5 text-xs font-medium">
              {motion > 0
                ? `${motion} ${plural(motion, 'mouvement détecté', 'mouvements détectés')}`
                : `${cameras.length} ${plural(cameras.length, 'caméra', 'caméras')} · rien à signaler`}
            </p>
          )}
        </div>
        <a
          href={widgetHref('alarm', 'arlo')}
          aria-label="Ouvrir la sécurité"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-coral focus-visible:outline-hidden"
        >
          <ArrowUpRight size={20} aria-hidden="true" />
        </a>
      </div>

      {alarm && state && (
        <div
          data-testid="home-alarm-panel"
          data-armed={isArmed}
          // Armed: a solid ink band (the house is shut); disarmed: an empty dashed outline (open).
          // A triggered alarm keeps the armed band and pulses.
          className={cn(
            'flex flex-row flex-wrap items-center justify-between gap-3 rounded-2xl',
            unusable
              ? 'bg-ink/10 p-4'
              : isArmed
                ? 'bg-ink p-4 text-white'
                : 'border-2 border-dashed border-ink/35 p-3.5',
            isTriggered && 'animate-pulse',
          )}
        >
          <a
            href={widgetHref('alarm')}
            data-testid="home-alarm-link"
            className="flex min-w-0 flex-row items-center gap-3 rounded-2xl focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-hidden"
          >
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                isArmed ? 'bg-white text-ink' : 'border-2 border-ink',
              )}
            >
              {isArmed ? (
                <ShieldCheck size={18} aria-hidden="true" />
              ) : (
                <ShieldOff size={18} aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className={cn('block text-sm font-semibold', isArmed && 'text-white/70')}>
                Alarme
              </span>
              <span
                data-testid="home-alarm-state"
                className="block font-display text-2xl leading-tight font-bold tracking-tight"
              >
                {alarmStatusLabel(state)}
              </span>
            </span>
          </a>
          {!unusable && (
            <Button
              data-testid="home-alarm-toggle"
              label={isArmed ? 'Désactiver' : 'Activer'}
              icon={isArmed ? Unlock : Lock}
              aria-pressed={isArmed}
              loading={loading === alarm.entity_id}
              onClick={toggleAlarm}
              className={cn(
                isArmed
                  ? 'bg-white/10 text-white hover:bg-white/20 active:bg-white/25'
                  : 'bg-ink text-white hover:bg-ink/90 active:bg-ink/80',
              )}
            />
          )}
        </div>
      )}

      {cameras.length > 0 && (
        // Stacked on a phone, where each picture would otherwise be too small; side by side as soon
        // as the tile is wide enough.
        <div className={cn('grid grid-cols-1 gap-2', cameras.length > 1 && 'md:grid-cols-2')}>
          {cameras.map((cam) => {
            const isMotion = cam.motionEntity?.state === 'on';
            const isOffline = cam.connectedEntity?.state === 'off';
            return (
              <a
                key={cam.id}
                href={widgetHref('arlo')}
                data-testid={`home-camera-${cam.id}`}
                aria-label={`Voir la caméra ${cam.name}`}
                className="relative block aspect-video overflow-hidden rounded-2xl bg-ink/80 focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-hidden"
              >
                <span className="absolute inset-0 flex items-center justify-center text-white/50">
                  <Camera size={24} aria-hidden="true" />
                </span>
                <SecureImage
                  src={cameraImageUrl(cam)}
                  keepPrevious
                  alt={cam.name}
                  className="absolute inset-0"
                />
                <span className="absolute inset-x-0 bottom-0 flex flex-row items-center justify-between gap-2 bg-gradient-to-t from-ink/80 to-transparent px-2.5 pt-6 pb-2 text-white">
                  <span className="truncate text-xs font-semibold">{cam.name}</span>
                  {isMotion ? (
                    <span className="shrink-0 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-ink">
                      Mouvement
                    </span>
                  ) : isOffline ? (
                    <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                      Hors ligne
                    </span>
                  ) : null}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
};
