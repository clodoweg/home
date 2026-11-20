/**
 * WeatherWidget — Current conditions + 5-day forecast with per-day hourly detail rows.
 */
import { translateCondition } from '../../lib/labels';
import React, { memo } from 'react';
import { Cloud, Wind, Umbrella } from 'lucide-react';
import { getWeatherIcon } from '../ui/WeatherIcon';
import { Skeleton } from '../ui/Skeleton';
import { BaseWidget, WidgetHighlight } from './BaseWidget';
import { HAState, type WeatherForecast } from '../../services/api';
import { useWeatherForecast } from '../../hooks/useWeatherForecast';
import { WIDGET_CONFIG } from '../../constants/widgets';
import { useWidgetPreferences } from '../../context/WidgetPreferencesContext';

const config = WIDGET_CONFIG.weather;

/** Rounded temperature with its unit, or a dash when the forecast has none. */
const formatTemperature = (value: number | undefined) =>
  value === undefined ? '–' : `${Math.round(value)}°`;

const getConditionColor = (condition: string) => {
  switch (condition) {
    case 'sunny':
    case 'clear-night':
      return 'text-success';
    case 'cloudy':
    case 'partlycloudy':
    case 'fog':
    case 'windy':
    case 'windy-variant':
      return 'text-warning';
    case 'rainy':
    case 'pouring':
    case 'snowy':
    case 'snowy-rainy':
    case 'hail':
    case 'lightning':
    case 'lightning-rainy':
    case 'exceptional':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
};

/**
 * Current weather and daily or hourly forecast.
 *
 * @param props - Weather entity.
 * @returns The widget.
 */
export const WeatherWidget = memo(function WeatherWidget({ entity }: { entity: HAState }) {
  // The forecasts only show in the widget body: none is fetched while it is collapsed.
  const expanded = !useWidgetPreferences().isCollapsed('weather');
  // Home Assistant refuses a forecast for an unavailable entity: no request until it comes back.
  const isWeatherAvailable = entity.state !== 'unavailable' && entity.state !== 'unknown';
  const shouldLoadForecasts = expanded && isWeatherAvailable;
  const { data: dailyForecast = [], isLoading: loadingDaily } = useWeatherForecast(
    entity,
    'daily',
    shouldLoadForecasts,
  );
  const { data: hourlyForecast = [], isLoading: loadingHourly } = useWeatherForecast(
    entity,
    'hourly',
    shouldLoadForecasts,
  );

  const getDayDetails = (dateString: string) => {
    const targetDate = new Date(dateString);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const dayHours = (hourlyForecast as WeatherForecast[]).filter((h) => {
      const d = new Date(h.datetime);
      return d >= dayStart && d <= dayEnd;
    });

    if (dayHours.length === 0) return null;

    const findClosest = (hour: number) => {
      if (dayHours.length === 0) return undefined;
      return dayHours.reduce((prev, curr) => {
        const prevH = new Date(prev.datetime).getHours();
        const currH = new Date(curr.datetime).getHours();
        return Math.abs(currH - hour) < Math.abs(prevH - hour) ? curr : prev;
      });
    };

    return {
      matin: findClosest(8),
      midi: findClosest(14),
      soir: findClosest(20),
      nuit: findClosest(23),
    };
  };

  if (!entity) return null;

  if (!isWeatherAvailable) {
    return (
      <BaseWidget id="weather" title={config.title} icon={config.icon} muted>
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <Cloud size={32} className="text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">Météo indisponible</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Le service de prévisions ne répond pas pour le moment
          </p>
        </div>
      </BaseWidget>
    );
  }

  const attributes = entity.attributes || {};
  const currentTemp = attributes.temperature;
  const currentCondition = entity.state;

  const subtitle = [
    <span key="1">
      <WidgetHighlight colorClass={getConditionColor(currentCondition)}>
        {translateCondition(currentCondition)}
      </WidgetHighlight>
    </span>,
    `${currentTemp}°`,
    `${attributes.wind_speed} km/h`,
  ];

  return (
    <BaseWidget id="weather" title={config.title} subtitle={subtitle} icon={config.icon}>
      <div>
        <div className="mb-6 flex flex-row items-center justify-between px-2">
          <div className="flex flex-row items-center gap-4">
            {getWeatherIcon(currentCondition, 48)}
            <div>
              <p className="text-3xl font-bold text-foreground">{currentTemp}°</p>
              <p className="text-sm text-muted-foreground capitalize">
                {translateCondition(currentCondition)}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex flex-row items-center gap-1">
              <Wind size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{attributes.wind_speed} km/h</span>
            </div>
            <div className="flex flex-row items-center gap-1">
              <Umbrella size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{attributes.pressure} hPa</span>
            </div>
          </div>
        </div>

        {loadingDaily ? (
          <div className="flex h-32 items-center justify-center">
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-2 px-2">
            {(dailyForecast as WeatherForecast[]).slice(0, 5).map((day, index) => {
              const date = new Date(day.datetime);
              let dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
              if (index === 0) dayName = "Aujourd'hui";
              else if (index === 1) dayName = 'Demain';

              const details = loadingHourly ? null : getDayDetails(day.datetime);

              return (
                <div key={day.datetime} className="mb-1">
                  <div className="flex flex-row items-center justify-between rounded-lg bg-muted px-3 py-1.5">
                    <span className="w-24 font-medium text-foreground capitalize">{dayName}</span>
                    <div className="flex flex-1 items-center justify-center">
                      {getWeatherIcon(day.condition, 20)}
                    </div>
                    <div className="flex w-24 flex-row items-center justify-end gap-3">
                      <span className="font-medium text-destructive">
                        {formatTemperature(day.temperature)}
                      </span>
                      <span className="font-medium text-info">
                        {formatTemperature(day.templow)}
                      </span>
                    </div>
                  </div>

                  {details ? (
                    <div className="mt-1 flex flex-row justify-between rounded-lg bg-secondary px-2 py-1">
                      {[
                        { label: 'Matin', data: details.matin },
                        { label: 'Midi', data: details.midi },
                        { label: 'Soir', data: details.soir },
                        { label: 'Nuit', data: details.nuit },
                      ].map((period) => (
                        <div key={period.label} className="flex w-1/4 flex-col items-center">
                          <span className="mb-1 text-[10px] text-muted-foreground">
                            {period.label}
                          </span>
                          {period.data ? (
                            <>
                              {getWeatherIcon(period.data.condition, 16)}
                              <span className="mt-1 text-xs text-foreground">
                                {formatTemperature(period.data.temperature)}
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">-</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BaseWidget>
  );
});
