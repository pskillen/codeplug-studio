import { useMemo, useState } from 'react';
import { Checkbox, TextInput } from '../../components/v2/index.ts';
import classes from './SatelliteFilter.module.css';

export interface SatelliteFilterOption {
  id: string;
  name: string;
}

export interface SatelliteFilterProps {
  label?: string;
  options: SatelliteFilterOption[];
  /** Selected satellite ids. Empty set means "no filter" — every satellite is shown. */
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
}

/**
 * Ephemeral, client-only checkbox-list-plus-search filter for narrowing a
 * page's rows down to a subset of satellites. Purpose-built for the Tracking
 * Dashboard pass grid — lighter than `MembershipPanel`, which is shaped for
 * persisted add/remove membership editing against a parent entity.
 */
export default function SatelliteFilter({
  label = 'Satellites',
  options,
  selectedIds,
  onChange,
}: SatelliteFilterProps) {
  const [search, setSearch] = useState('');

  const visibleOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.name.toLowerCase().includes(query));
  }, [options, search]);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  return (
    <div className={classes.root}>
      <TextInput
        label={label}
        placeholder="Search satellites…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className={classes.list} role="group" aria-label={label}>
        {visibleOptions.length === 0 ? (
          <p className={classes.empty}>No satellites match &ldquo;{search}&rdquo;.</p>
        ) : (
          visibleOptions.map((option) => (
            <label key={option.id} className={classes.option}>
              <Checkbox
                checked={selectedIds.has(option.id)}
                onCheckedChange={() => toggle(option.id)}
                aria-label={option.name}
              />
              <span>{option.name}</span>
            </label>
          ))
        )}
      </div>
      {selectedIds.size > 0 ? (
        <button type="button" className={classes.clearButton} onClick={() => onChange(new Set())}>
          Clear filter ({selectedIds.size})
        </button>
      ) : null}
    </div>
  );
}
