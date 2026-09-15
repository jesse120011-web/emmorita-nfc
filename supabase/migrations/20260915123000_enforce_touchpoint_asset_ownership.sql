-- Migration: enforce touchpoint asset ownership
-- Ensures touchpoints.qr_code_id / touchpoints.nfc_tag_id (if provided)
-- exist and their business_id equals the touchpoint.business_id.
-- IMPORTANT: This migration includes a pre-check that aborts if any existing
-- inconsistent rows are found. Do not proceed until conflicts are resolved.

begin;

-- Pre-check: detect inconsistent touchpoints (if any exist, abort)
do $$
declare
  _exists boolean;
begin
  select exists (
    (
      select 1
      from public.touchpoints t
      left join public.qr_codes q on q.id = t.qr_code_id
      where t.qr_code_id is not null
        and (q.id is null or q.business_id is distinct from t.business_id)
      limit 1
    )
    union
    (
      select 1
      from public.touchpoints t
      left join public.nfc_tags n on n.id = t.nfc_tag_id
      where t.nfc_tag_id is not null
        and (n.id is null or n.business_id is distinct from t.business_id)
      limit 1
    )
  ) into _exists;

  if _exists then
    raise exception 'Touchpoint asset ownership inconsistency detected. Run the preflight SELECTs provided in the migration notes to list conflicting rows and remediate before applying this migration.';
  end if;
end;
$$;

-- Create enforcement function
create or replace function public.enforce_touchpoint_asset_ownership()
returns trigger
language plpgsql
as $$
declare
  _qr_b uuid;
  _nfc_b uuid;
begin
  -- If qr_code_id provided: ensure asset exists and belongs to same business
  if new.qr_code_id is not null then
    select business_id into _qr_b
    from public.qr_codes
    where id = new.qr_code_id;

    if _qr_b is null then
      raise exception using
        errcode = '23514',
        message = format('qr_code_id % does not exist', new.qr_code_id);
    end if;

    if _qr_b is distinct from new.business_id then
      raise exception using
        errcode = '23514',
        message = format('qr_code_id % belongs to business % not %', new.qr_code_id, _qr_b, new.business_id);
    end if;
  end if;

  -- If nfc_tag_id provided: ensure asset exists and belongs to same business
  if new.nfc_tag_id is not null then
    select business_id into _nfc_b
    from public.nfc_tags
    where id = new.nfc_tag_id;

    if _nfc_b is null then
      raise exception using
        errcode = '23514',
        message = format('nfc_tag_id % does not exist', new.nfc_tag_id);
    end if;

    if _nfc_b is distinct from new.business_id then
      raise exception using
        errcode = '23514',
        message = format('nfc_tag_id % belongs to business % not %', new.nfc_tag_id, _nfc_b, new.business_id);
    end if;
  end if;

  return new;
end;
$$;

-- Install trigger
create trigger touchpoints_enforce_asset_ownership
before insert or update on public.touchpoints
for each row execute function public.enforce_touchpoint_asset_ownership();

commit;
