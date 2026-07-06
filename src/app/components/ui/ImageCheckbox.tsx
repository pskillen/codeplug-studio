import {
  Checkbox,
  Image,
  Input,
  SimpleGrid,
  Text,
  UnstyledButton,
  type SimpleGridProps,
} from '@mantine/core';
import { useUncontrolled } from '@mantine/hooks';
import type { ReactNode } from 'react';
import classes from './ImageCheckbox.module.css';

export interface ImageCheckboxProps {
  title: ReactNode;
  description?: ReactNode;
  /** Image URL — use `media` instead when no image is needed. */
  imageSrc?: string;
  imageAlt?: string;
  /** Leading content when `imageSrc` is omitted (e.g. a `ModePill`). */
  media?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function ImageCheckbox({
  title,
  description,
  imageSrc,
  imageAlt,
  media,
  checked,
  defaultChecked,
  onChange,
  disabled,
}: ImageCheckboxProps) {
  const [value, setValue] = useUncontrolled({
    value: checked,
    defaultValue: defaultChecked,
    finalValue: false,
    onChange,
  });

  const alt = imageAlt ?? (typeof title === 'string' ? title : 'Option');

  return (
    <UnstyledButton
      type="button"
      disabled={disabled}
      onClick={() => setValue(!value)}
      data-checked={value || undefined}
      className={classes.button}
      aria-pressed={value}
    >
      <div className={classes.media}>
        {imageSrc ? <Image src={imageSrc} alt={alt} w={40} h={40} radius="sm" /> : media}
      </div>

      <div className={classes.body}>
        {description ? (
          <Text c="dimmed" size="xs" lh={1} mb={5}>
            {description}
          </Text>
        ) : null}
        <Text fw={500} size="sm" lh={1}>
          {title}
        </Text>
      </div>

      <Checkbox
        className={classes.checkbox}
        checked={value}
        onChange={() => {}}
        tabIndex={-1}
        disabled={disabled}
        styles={{ input: { cursor: 'pointer' } }}
        aria-hidden
      />
    </UnstyledButton>
  );
}

export interface ImageCheckboxOption<T extends string = string> {
  value: T;
  title: ReactNode;
  description?: ReactNode;
  imageSrc?: string;
  imageAlt?: string;
  media?: ReactNode;
  disabled?: boolean;
}

export interface ImageCheckboxGroupProps<T extends string = string> {
  label?: ReactNode;
  description?: ReactNode;
  value: readonly T[];
  onChange: (value: T[]) => void;
  options: readonly ImageCheckboxOption<T>[];
  cols?: SimpleGridProps['cols'];
}

export function ImageCheckboxGroup<T extends string>({
  label,
  description,
  value,
  onChange,
  options,
  cols = { base: 1, sm: 2 },
}: ImageCheckboxGroupProps<T>) {
  const selected = new Set(value);

  const toggle = (optionValue: T) => {
    if (selected.has(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const field = (
    <SimpleGrid cols={cols} spacing="sm">
      {options.map((option) => (
        <ImageCheckbox
          key={option.value}
          title={option.title}
          description={option.description}
          imageSrc={option.imageSrc}
          imageAlt={option.imageAlt}
          media={option.media}
          checked={selected.has(option.value)}
          onChange={() => toggle(option.value)}
          disabled={option.disabled}
        />
      ))}
    </SimpleGrid>
  );

  if (label != null) {
    return (
      <Input.Wrapper label={label} description={description}>
        {field}
      </Input.Wrapper>
    );
  }

  return field;
}
