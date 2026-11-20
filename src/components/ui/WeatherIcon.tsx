/** WeatherIcon — Icon of a Home Assistant weather condition, shared by the weather widget and the home screen. */
import React from 'react';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Moon,
  Sun,
  Wind,
} from 'lucide-react';

const CloudSunIcon = ({ size, cloudClass }: { size: number; cloudClass: string }) => (
  <div className="relative" style={{ width: size, height: size }}>
    <Cloud size={size} className={cloudClass} />
    <div className="absolute top-[-2px] right-[-2px] opacity-80">
      <Sun size={size * 0.5} className="text-warning" />
    </div>
  </div>
);

/**
 * Icon of a weather condition.
 *
 * @param condition - State of a `weather.*` entity or of a forecast entry (`sunny`, `rainy`…).
 * @param size - Icon size in pixels.
 * @param onTone - True on a coloured tile: clouds, rain, snow, fog and wind take the tile's text
 * colour, since the blue and grey ones would vanish on it; the sun, moon and lightning keep theirs.
 * @returns The icon; a plain cloud for an unknown condition.
 */
export const getWeatherIcon = (condition: string | undefined, size = 24, onTone = false) => {
  const cloudClass = onTone ? 'text-current' : 'text-foreground dark:text-white';
  const greyClass = onTone ? 'text-current' : 'text-muted-foreground';
  const wetClass = onTone ? 'text-current' : 'text-info';
  switch (condition) {
    case 'sunny':
      return <Sun size={size} className="text-warning" />;
    case 'clear-night':
      return <Moon size={size} className="text-warning" />;
    case 'partlycloudy':
      return <CloudSunIcon size={size} cloudClass={cloudClass} />;
    case 'cloudy':
      return <Cloud size={size} className={greyClass} />;
    case 'fog':
      return <CloudFog size={size} className={greyClass} />;
    case 'hail':
    case 'snowy':
    case 'snowy-rainy':
      return <CloudSnow size={size} className={wetClass} />;
    case 'rainy':
    case 'pouring':
      return <CloudRain size={size} className={wetClass} />;
    case 'lightning':
    case 'lightning-rainy':
      return <CloudLightning size={size} style={{ color: '#FDB813' }} />;
    case 'windy':
    case 'windy-variant':
      return <Wind size={size} className={greyClass} />;
    default:
      return <Cloud size={size} className={cloudClass} />;
  }
};
