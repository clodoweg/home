/**
 * FeederTimeline — Filterable event timeline for the Petkit feeder with preview images.
 */
import React from 'react';
import { Activity, Cat, Utensils } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../../../lib/utils';
import { SecureImage } from '../../ui/SecureImage';
import { PetKitData, API_URL } from '../../../services/api';
import { Panel } from '../../ui/Panel';
import { logger } from '../../../lib/logger';

type TimelineFilter = 'all' | 'activity' | 'eat' | 'feed' | null;

interface FeederTimelineProps {
  recordsForDay: PetKitData['records'];
  filteredRecords: PetKitData['records'];
  timelineFilter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
  movesCount: number;
  visitsCount: number;
  eatsCount: number;
  feedsCount: number;
  canAccessHistory: boolean;
  selectedDate: Date;
  getDateLabel: (date: Date) => string;
}

function toAbsoluteUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

function getRecordTitle(record: PetKitData['records'][number]): string {
  switch (record.type) {
    case 1:
      return 'Mouvement détecté';
    case 2:
      return 'Un animal de passage';
    case 3:
      return 'Un animal se nourrit';
    case 4:
      return 'Distribution';
    default: {
      const genericMessages = [
        'Viens lui dire bonjour',
        'Venez voir ce que ça fait',
        'Avez-vous vu cette charmante expression',
        'Ce petit est tout simplement enchanteur',
      ];
      return record.content && !genericMessages.some((m) => record.content?.includes(m))
        ? record.content
        : 'Événement';
    }
  }
}

/**
 * Filterable timeline of the feeder events of a day.
 *
 * @param props - Records of the day, filter and counts.
 * @returns The timeline.
 */
export const FeederTimeline = ({
  recordsForDay,
  filteredRecords,
  timelineFilter,
  onFilterChange,
  movesCount,
  visitsCount,
  eatsCount,
  feedsCount,
  canAccessHistory,
  selectedDate,
  getDateLabel,
}: FeederTimelineProps) => {
  const totalCount = recordsForDay.filter((r) => [1, 2, 3, 4, 5].includes(r.type)).length;

  const filters: { key: TimelineFilter; label: string }[] = [
    { key: 'all', label: `Tout ${totalCount}` },
    { key: 'activity', label: `Passage ${movesCount + visitsCount}` },
    { key: 'eat', label: `Manger ${eatsCount}` },
    { key: 'feed', label: `Distribution ${feedsCount}` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="mb-4">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Événements
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map(({ key, label }) => (
            <button
              type="button"
              key={key}
              onClick={() => onFilterChange(timelineFilter === key ? null : key)}
              className={cn(
                'rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors',
                timelineFilter === key
                  ? 'bg-coral font-semibold text-white'
                  : 'bg-muted font-medium text-muted-foreground hover:bg-secondary',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Panel>

      {timelineFilter !== null && (
        <Panel>
          <div className="flex flex-col gap-6">
            {filteredRecords.slice(0, 100).map((record) => {
              const title = getRecordTitle(record);
              const timeStr = record.time
                ? format(new Date(record.time * 1000), 'HH:mm', { locale: fr })
                : '';
              const hasComparison = canAccessHistory && record.preview1 && record.preview2;
              const rid = record.id || record.eventId || String(record.time);
              const mainImg = toAbsoluteUrl(record.preview);
              const img1 = toAbsoluteUrl(record.preview1);
              const img2 = toAbsoluteUrl(record.preview2);

              const badgeBg =
                record.type === 3
                  ? 'bg-lime'
                  : record.type === 4
                    ? 'bg-cobalt'
                    : record.type === 1 || record.type === 10
                      ? 'bg-coral'
                      : 'bg-lilac';

              return (
                <div key={rid} className="flex flex-row gap-4">
                  <div className="flex h-7 w-12 items-center justify-end">
                    <span className="text-base font-bold text-foreground">{timeStr}</span>
                  </div>

                  <div className="relative flex-1 border-l-2 border-border pb-6 pl-6">
                    <div
                      className={cn(
                        'absolute top-0 left-[-14px] flex size-7 items-center justify-center rounded-full ring-4 ring-background',
                        badgeBg,
                      )}
                    >
                      {record.type === 3 || record.type === 2 ? (
                        <Cat size={14} className="text-white" />
                      ) : record.type === 4 || record.type === 5 ? (
                        <Utensils size={14} className="text-white" />
                      ) : (
                        <Activity size={14} className="text-white" />
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex h-7 items-center">
                        <p className="text-sm leading-tight font-medium text-foreground">{title}</p>
                      </div>

                      {(canAccessHistory || isToday(selectedDate)) && (mainImg || img1 || img2) && (
                        <div className="mt-2 flex flex-col gap-2">
                          {record.preview && mainImg && (
                            <div className="aspect-video w-full overflow-hidden rounded-xl bg-muted">
                              <SecureImage
                                src={mainImg}
                                className="size-full"
                                onError={(e: unknown) =>
                                  logger.error(
                                    `[ImageError] mainImg failed: ${mainImg.split('?')[0]}`,
                                    e,
                                  )
                                }
                              />
                            </div>
                          )}
                          {hasComparison && (img1 || img2) && (
                            <div className="flex flex-row gap-2">
                              {[
                                { img: img1, label: 'Avant' },
                                { img: img2, label: 'Après' },
                              ].map(({ img, label }) => (
                                <div key={label} className="flex-1">
                                  <div className="aspect-video w-full overflow-hidden rounded-xl bg-muted">
                                    {img && <SecureImage src={img} className="size-full" />}
                                  </div>
                                  <p className="mt-1 text-center text-[10px] font-medium text-muted-foreground italic">
                                    {label}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredRecords.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Aucun événement {getDateLabel(selectedDate).toLowerCase()}
              </p>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
};
