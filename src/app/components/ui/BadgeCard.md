# BadgeCard

## Purpose

Feature card with optional hero image, title block, badge row, and footer action. Adapted from [Mantine UI — Card with badges](https://ui.mantine.dev/category/app-cards/#badge-card).

## Props

| Prop          | Type               | Description                                      |
| ------------- | ------------------ | ------------------------------------------------ |
| `title`       | `string`           | Primary heading                                  |
| `subtitle`    | `string`           | Uppercase label opposite title (e.g. region tag) |
| `description` | `string`           | Dimmed body copy                                 |
| `image`       | `string`           | Hero image URL                                   |
| `media`       | `ReactNode`        | Hero slot when no `image` (icon, illustration)   |
| `badges`      | `BadgeCardBadge[]` | Light badges with optional emoji prefix          |
| `badgesTitle` | `string`           | Section label above badges (default: Highlights) |
| `actionLabel` | `string`           | Footer button label                              |
| `onAction`    | `() => void`       | Footer button handler                            |
| `action`      | `ReactNode`        | Custom footer (overrides action button)          |
| `onClick`     | `() => void`       | Makes entire card a clickable `UnstyledButton`   |

## Usage

```tsx
import BadgeCard from '@app/components/ui/BadgeCard.tsx';

<BadgeCard
  title="OpenAIP"
  subtitle="Aviation"
  description="Search airports and import RX-only AM airband channels."
  badges={[{ emoji: '✈️', label: 'Airband' }]}
  onClick={() => navigate('/library/channels/add-from-openaip')}
/>;
```
