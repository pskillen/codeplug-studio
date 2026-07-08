import { Badge, Button, Card, Group, Image, Text, UnstyledButton } from '@mantine/core';
import type { CardProps } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './BadgeCard.module.css';

export interface BadgeCardBadge {
  emoji?: string;
  label: string;
}

export interface BadgeCardProps {
  image?: string;
  imageAlt?: string;
  /** Leading hero when `image` is omitted (icon, illustration, etc.). */
  media?: ReactNode;
  title: string;
  subtitle?: string;
  description?: string;
  badgesTitle?: string;
  badges?: readonly BadgeCardBadge[];
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  onClick?: () => void;
  padding?: CardProps['padding'];
}

/**
 * Card with image/media, title block, optional feature badges, and footer action.
 * Adapted from [Mantine UI — Card with badges](https://ui.mantine.dev/category/app-cards/#badge-card).
 */
export default function BadgeCard({
  image,
  imageAlt,
  media,
  title,
  subtitle,
  description,
  badgesTitle = 'Highlights',
  badges = [],
  actionLabel,
  onAction,
  action,
  onClick,
  padding = 'md',
}: BadgeCardProps) {
  const features = badges.map((badge) => (
    <Badge key={badge.label} variant="light" leftSection={badge.emoji}>
      {badge.label}
    </Badge>
  ));

  const card = (
    <Card className={classes.card} padding={padding} radius="md" withBorder>
      {image ? (
        <Card.Section>
          <Image src={image} alt={imageAlt ?? title} height={160} />
        </Card.Section>
      ) : media ? (
        <Card.Section className={classes.mediaHero}>{media}</Card.Section>
      ) : null}

      <Card.Section className={classes.section} mt="md">
        <Group justify="apart">
          <Text fz="lg" fw={500}>
            {title}
          </Text>
          {subtitle ? (
            <Text fz="lg" fw={500} className={classes.label}>
              {subtitle}
            </Text>
          ) : null}
        </Group>
        {description ? (
          <Text fz="sm" mt="xs" c="dimmed">
            {description}
          </Text>
        ) : null}
      </Card.Section>

      {badges.length > 0 ? (
        <Card.Section className={classes.section}>
          <Text mt="md" className={classes.label} c="dimmed">
            {badgesTitle}
          </Text>
          <Group gap={7} mt={5}>
            {features}
          </Group>
        </Card.Section>
      ) : null}

      {action ??
        (actionLabel && onAction ? (
          <Group justify="space-between" mt="md">
            <Button variant="light" onClick={onAction}>
              {actionLabel}
            </Button>
          </Group>
        ) : null)}
    </Card>
  );

  if (onClick) {
    return (
      <UnstyledButton type="button" className={classes.clickable} onClick={onClick}>
        {card}
      </UnstyledButton>
    );
  }

  return card;
}
