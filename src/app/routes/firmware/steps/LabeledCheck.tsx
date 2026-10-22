import { Checkbox } from '../../../components/v2/index.ts';
import classes from '../FirmwareFlasherPage.module.css';

export default function LabeledCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={classes.checkRow}>
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
