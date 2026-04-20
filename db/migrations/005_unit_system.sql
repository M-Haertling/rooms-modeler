UPDATE project SET unit = 'standard' WHERE unit IN ('feet', 'inches');
UPDATE project SET unit = 'metric' WHERE unit IN ('cm', 'm', 'mm');
