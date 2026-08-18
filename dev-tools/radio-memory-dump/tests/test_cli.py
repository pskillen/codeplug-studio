"""CLI behaviour tests (no live serial)."""

import pytest

from radio_memory_dump.cli import refuse_write_flags, region_filename, parse_regions


def test_refuse_write_flag():
    with pytest.raises(SystemExit, match="read-only"):
        refuse_write_flags(["--write"])


def test_refuse_program_flag():
    with pytest.raises(SystemExit, match="read-only"):
        refuse_write_flags(["--program"])


def test_refuse_w_short_flag():
    with pytest.raises(SystemExit, match="read-only"):
        refuse_write_flags(["-w"])


def test_region_filename():
    assert region_filename("flash", 0x3780, 32) == "flash_0x3780_32.bin"


def test_parse_regions():
    regions = parse_regions(["flash:0x3780:32", "eeprom:0x3780:32"])
    assert len(regions) == 2
    assert regions[0].mem_label == "flash"
    assert regions[1].mem_label == "eeprom"
