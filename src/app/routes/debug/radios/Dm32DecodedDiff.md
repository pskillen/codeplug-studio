# DM-32 decoded comparison

`Dm32DecodedDiff` renders the captured identity, calibration and factory evidence returned by the pure DM-32 comparison. It accepts two debug archives through the descriptor's decoded-diff hook. It decodes classified bytes, not archive decoded summaries. Missing and invalid values are unavailable; anti-clone material remains in raw archive and hex views. Sparse regions with different partitions may not be comparable. There is no calibration overlay.
