/**
 * DashboardScreen — Main application screen.
 * Orchestrates all widget data (Home Assistant, Petkit) via React Query, shows the section named
 * by the URL hash (home overview, then one section per domain) and the settings overlay, and
 * delegates light interactions to useLights.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { NavigationMenu } from '../components/ui/NavigationMenu';
import { OverlayMenu } from '../components/ui/OverlayMenu';
import { AppHeader } from '../components/ui/AppHeader';
import { SectionNav } from '../components/ui/SectionNav';
import { WidgetGrid } from '../components/ui/WidgetGrid';
// Static on purpose: as a lazy chunk it splits UserContext into a shared chunk, where the
// build no longer drops the simulated auth (caught by check:dist).
import { AlertsScreen } from './AlertsScreen';
import { HomeOverview } from './HomeOverview';
// Static for the same reason; its recharts charts are loaded on first display (LazyHistoryCharts).
import { HistoryScreen } from './history/HistoryScreen';
import { HISTORY_SECTION, HOME_SECTION, SECTIONS } from '../constants/sections';
import { WIDGET_CONFIG } from '../constants/widgets';
import { useSection } from '../hooks/useSection';
import { requestWidgetDetail } from '../lib/widget-detail';
import { useAlertNotifications } from '../hooks/useAlertNotifications';
import { summarizeHome } from '../lib/home-summary';
import { isArloEntity } from '../constants/entities';
import { useStableValue } from '../hooks/useStableValue';
import { ProfileGuard } from '../components/ui/ProfileGuard';
import { useUserProfile } from '../context/UserContext';
import { useResponsive } from '../hooks/useResponsive';
import { useWidgetPreferences } from '../context/WidgetPreferencesContext';
import { useHAData } from '../hooks/useHAData';
import { usePetkitData } from '../hooks/usePetkitData';
import { useLights } from '../hooks/useLights';
import { useDashboardWidgets } from '../hooks/useDashboardWidgets';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/query-keys';

const ReorderScreen = React.lazy(() =>
  import('./ReorderScreen').then((m) => ({ default: m.ReorderScreen })),
);

const NotificationsScreen = React.lazy(() =>
  import('./NotificationsScreen').then((m) => ({ default: m.NotificationsScreen })),
);

/**
 * Main screen: loads the data, refreshes it when the app comes back to the foreground, and lays out the widgets.
 *
 * @returns The dashboard, or the customization and notification screens it navigates to.
 */
export const DashboardScreen = () => {
  const { isMobile } = useResponsive();
  const {
    user,
    canAccessHistory,
    canAccessCameras,
    isAdmin,
    profileError,
    refreshProfile,
    loading: profileLoading,
  } = useUserProfile();
  const { widgetOrder, isWidgetHidden, isRoomHidden, roomOrder, floorOrder, unfoldOnly } =
    useWidgetPreferences();
  const { section: requestedSection, focus, detail } = useSection();
  const queryClient = useQueryClient();

  const [activeMenu, setActiveMenu] = useState<
    'none' | 'main' | 'reorder' | 'notifications' | 'alerts'
  >('none');
  const { enabled: alertsEnabled, unread: unreadAlerts } = useAlertNotifications();
  const closeMenu = useCallback(() => setActiveMenu('none'), []);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const stableRights = useMemo(
    () => ({ history: canAccessHistory, cameras: canAccessCameras }),
    [canAccessHistory, canAccessCameras],
  );

  const {
    data: haData,
    error: haError,
    dataUpdatedAt,
    isLoading: haLoading,
    isFetching: haFetching,
  } = useHAData(autoRefresh);
  const { data: petkitData, isLoading: petkitLoading } = usePetkitData(autoRefresh);

  const isRestoring = useIsRestoring();
  // Only Home Assistant gates the first paint: the Petkit cloud is often slower, its tile waits
  // on its own.
  const isInitialLoad = haLoading && !haData;

  const lights = useMemo(() => haData?.lights ?? [], [haData?.lights]);
  const sensors = useMemo(() => haData?.sensors ?? [], [haData?.sensors]);
  const scenes = useMemo(() => haData?.scenes ?? [], [haData?.scenes]);
  const alarms = useMemo(() => haData?.alarms ?? [], [haData?.alarms]);
  const weather = useMemo(() => haData?.weather ?? [], [haData?.weather]);
  const all = useMemo(() => haData?.all ?? [], [haData?.all]);
  const metadata = useMemo(() => haData?.metadata ?? {}, [haData?.metadata]);
  const petkit = petkitData ?? null;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  /**
   * Room names derived from temperature sensors — used to populate the
   * "Pièces" tab in ReorderScreen without requiring TemperatureWidget to mount.
   */
  const availableRooms = useMemo(() => {
    const roomMap = new Map<string, string>();
    sensors.forEach((s) => {
      const deviceClass = s.attributes.device_class;
      if (deviceClass !== 'temperature' && deviceClass !== 'humidity') return;
      const area = metadata[s.entity_id]?.area || 'Autres';
      const floor = metadata[s.entity_id]?.floor || 'Autres';
      roomMap.set(area, floor);
    });
    lights.forEach((l) => {
      const area = metadata[l.entity_id]?.area || 'Autres';
      const floor = metadata[l.entity_id]?.floor || 'Autres';
      roomMap.set(area, floor);
    });
    return Array.from(roomMap.entries()).map(([room, floor]) => ({ room, floor }));
  }, [sensors, lights, metadata]);

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.ha.states });
    queryClient.invalidateQueries({ queryKey: queryKeys.ha.metadata });
    queryClient.invalidateQueries({ queryKey: queryKeys.petkit.all });
    setRefreshTrigger((prev) => prev + 1);
  }, [queryClient]);

  const onRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: queryKeys.ha.states }),
      queryClient.refetchQueries({ queryKey: queryKeys.petkit.all }),
    ]);
    setRefreshTrigger((prev) => prev + 1);
  }, [queryClient]);

  // Back in the foreground, the dashboard keeps showing the last known values and refreshes them
  // in the background: the header's spinning icon and "MAJ hh:mm" say how fresh they are. No
  // blocking overlay, whatever the age of the data (the user asked for no wait on resume).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const refreshedKeys = [
        queryKeys.ha.states,
        queryKeys.petkit.all,
        queryKeys.ha.scenes,
        queryKeys.ha.histories,
        queryKeys.ha.historyBatches,
        queryKeys.ha.forecasts,
        queryKeys.energy.all,
        queryKeys.history.all,
      ];
      for (const queryKey of refreshedKeys) {
        // Errors are logged and shown by the query layer; nothing to do here.
        void queryClient.refetchQueries({ queryKey, type: 'active', stale: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [queryClient]);

  const {
    handleToggleLight,
    handleSetBrightness,
    handleActivateScene,
    getLightState,
    getLightBrightness,
  } = useLights({
    lights: haData?.lights ?? [],
    metadata: haData?.metadata ?? {},
  });

  const lightsActions = useMemo(
    () => ({
      onToggle: handleToggleLight,
      onSetBrightness: handleSetBrightness,
      onActivateScene: handleActivateScene,
      getLightState,
      getLightBrightness,
    }),
    [
      handleToggleLight,
      handleSetBrightness,
      handleActivateScene,
      getLightState,
      getLightBrightness,
    ],
  );

  const widgetDefinitions = useDashboardWidgets({
    haAll: haData?.all,
    all,
    lights,
    sensors,
    scenes,
    alarms,
    weather,
    metadata,
    petkit,
    petkitLoading,
    profileLoading,
    stableRights,
    lightsActions,
    refreshAll,
    refreshTrigger,
  });

  const orderedWidgets = widgetOrder
    .map((id) => ({ id, component: widgetDefinitions[id] }))
    // Exclude widgets with null components (not available for this user) and explicitly hidden ones.
    .filter((w) => w.component !== null && !isWidgetHidden(w.id));
  const visibleWidgets = new Set(orderedWidgets.map((w) => w.id));

  // A section without a visible widget (rights, hidden widgets) is not offered; the history tab
  // needs the history right, like the back's history routes.
  const sections = SECTIONS.filter(
    (s) =>
      s.id === HOME_SECTION ||
      (s.id === HISTORY_SECTION
        ? canAccessHistory
        : s.widgets.some((id) => visibleWidgets.has(id))),
  );
  const section = sections.find((s) => s.id === requestedSection) ?? sections[0];
  const sectionWidgets = orderedWidgets.filter((w) => section.widgets.includes(w.id));
  const sectionWidgetIds = sectionWidgets.map((w) => w.id).join(',');

  // A home tile links to `#<section>/<widget>`: that widget is unfolded, the others of the
  // section folded, and the page scrolls to it. The hash then goes back to `#<section>` so that a
  // reload or the back button keeps the user's own folding.
  const handledFocusRef = useRef<readonly string[]>([]);
  useEffect(() => {
    if (focus.length === 0 || handledFocusRef.current === focus) return;
    handledFocusRef.current = focus;
    window.history.replaceState(null, '', `#${section.id}`);
    const ids = sectionWidgetIds.split(',');
    const targets = focus.filter((id) => ids.includes(id));
    if (targets.length === 0) {
      window.scrollTo(0, 0);
      return;
    }
    unfoldOnly(ids, targets);
    // `#maison/temperature/<sensor>`: the widget also opens that sensor, and the page scrolls to
    // it rather than to the top of the widget.
    if (detail) requestWidgetDetail(targets[0], detail);
    const scrollToTarget = () =>
      (
        (detail && document.querySelector(`[data-widget-detail="${CSS.escape(detail)}"]`)) ||
        document.querySelector(`[data-testid="widget-${targets[0]}"]`)
      )?.scrollIntoView({ block: detail ? 'center' : 'start' });
    requestAnimationFrame(scrollToTarget);
    // Again once the folding animations (0.2 s) of the widgets above have settled.
    const timer = window.setTimeout(scrollToTarget, 400);
    return () => window.clearTimeout(timer);
  }, [focus, detail, section.id, sectionWidgetIds, unfoldOnly]);

  // Same filter as the cameras widget (useDashboardWidgets), kept stable across polls.
  const arloEntities = useStableValue(
    useMemo(() => all.filter((e) => isArloEntity(e.entity_id)), [all]),
  );
  const summary = useMemo(
    () =>
      summarizeHome({
        all,
        lights,
        weather,
        metadata,
        isRoomHidden,
        roomOrder,
        floorOrder,
      }),
    [all, lights, weather, metadata, isRoomHidden, roomOrder, floorOrder],
  );
  const toggleLights = useCallback(
    (entityIds: string[]) => entityIds.forEach((id) => handleToggleLight(id)),
    [handleToggleLight],
  );

  if (profileLoading || profileError) {
    return (
      <ProfileGuard
        loading={profileLoading}
        error={profileError}
        onRetry={() => refreshProfile()}
      />
    );
  }

  // The persisted cache is read back asynchronously: painting the dashboard before that would
  // show it empty, then move everything when the data arrives (CLS 0.95 measured on warm starts).
  if (isRestoring) {
    return <div className="flex min-h-screen flex-1 bg-background" />;
  }

  if (isInitialLoad) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
        <div className="size-10 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col bg-background">
      <AppHeader
        sections={sections}
        section={section.id}
        lastUpdated={lastUpdated}
        isFetching={haFetching && !!haData}
        haError={haError}
        menuOpen={activeMenu !== 'none'}
        isMobile={isMobile}
        onOpenMenu={() => setActiveMenu('main')}
        onOpenAlerts={alertsEnabled ? () => setActiveMenu('alerts') : undefined}
        unreadAlerts={unreadAlerts}
      />
      <main className="mx-auto w-full max-w-[1392px] flex-1 px-3 pt-1 pb-28 sm:px-6 md:pb-10">
        {section.id === HOME_SECTION ? (
          <HomeOverview
            summary={summary}
            widgetIds={orderedWidgets.map((w) => w.id)}
            sensors={sensors}
            metadata={metadata}
            petkit={petkit}
            petkitLoading={petkitLoading && !petkitData}
            firstName={user?.firstName}
            weatherEntity={weather[0]}
            alarmEntity={alarms[0]}
            arloEntities={arloEntities}
            onToggleLights={toggleLights}
          />
        ) : section.id === HISTORY_SECTION ? (
          <HistoryScreen
            visibleWidgets={visibleWidgets}
            sensors={sensors}
            metadata={metadata}
            isAdmin={isAdmin}
          />
        ) : (
          <>
            <h1 className="px-2 pt-2 pb-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {section.label}
            </h1>
            <WidgetGrid
              items={sectionWidgets.map((w) => ({
                key: w.id,
                node: w.component,
                wide: WIDGET_CONFIG[w.id]?.wide,
              }))}
            />
          </>
        )}
      </main>
      {isMobile && <SectionNav sections={sections} current={section.id} variant="bar" />}

      <OverlayMenu
        isOpen={activeMenu !== 'none'}
        onClose={() => setActiveMenu('none')}
        showDesktopHeader={activeMenu === 'main'}
        title={
          activeMenu === 'reorder'
            ? 'Réorganiser'
            : activeMenu === 'notifications'
              ? 'Notifications'
              : activeMenu === 'alerts'
                ? 'Alertes'
                : 'Réglages'
        }
        desktopWidth={activeMenu === 'reorder' ? 'w-full max-w-[1248px]' : 'w-[640px]'}
        desktopMaxHeight="max-h-[80vh] overflow-hidden"
      >
        <Suspense
          fallback={
            <div className="flex justify-center p-12">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          }
        >
          {activeMenu === 'reorder' && (
            <ReorderScreen
              availableRooms={availableRooms}
              sensors={sensors}
              metadata={metadata}
              onNavigate={(screen) =>
                setActiveMenu(screen === 'dashboard' ? 'none' : (screen as 'main' | 'reorder'))
              }
            />
          )}
          {activeMenu === 'notifications' && <NotificationsScreen />}
          {activeMenu === 'alerts' && <AlertsScreen onClose={closeMenu} />}
        </Suspense>
        {activeMenu === 'main' && (
          <NavigationMenu
            onClose={() => setActiveMenu('none')}
            onRefresh={onRefresh}
            autoRefresh={autoRefresh}
            onToggleAutoRefresh={setAutoRefresh}
            onNavigate={(screen) => setActiveMenu(screen as 'main' | 'reorder' | 'notifications')}
            canAccessNotifications={isAdmin}
          />
        )}
      </OverlayMenu>
    </div>
  );
};
