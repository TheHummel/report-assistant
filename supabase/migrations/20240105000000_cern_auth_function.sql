-- Function to check or create CERN user in auth.users
create or replace function public.check_or_create_cern_user(
  user_email text,
  user_name text default null
)
returns text
language plpgsql
security definer
as $$
declare
  existing_user_id uuid;
begin
  -- Check if user exists
  select id into existing_user_id
  from auth.users
  where email = user_email;
  
  if existing_user_id is not null then
    return user_email;
  end if;
  
  -- Create new user with email as ID
  insert into auth.users (
    id,
    email,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    instance_id,
    aud,
    role
  ) values (
    gen_random_uuid(),
    user_email,
    now(),
    jsonb_build_object('name', coalesce(user_name, split_part(user_email, '@', 1))),
    now(),
    now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  );
  
  return user_email;
end;
$$;
