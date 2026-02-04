-- Initial schema for LARS (LaTeX Report Assistant)
-- This creates all the base tables, RLS policies, and functions

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Projects table
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  template_id text default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Documents table
create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  content text default '',
  filename text,
  document_type text,
  is_public boolean default false,
  compile_settings jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Document versions table (for version history)
create table if not exists document_versions (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  change_summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Files table (for project file metadata)
create table if not exists files (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  type text,
  size integer,
  url text,
  uploaded_at timestamptz default now()
);

-- Drafts table (for temporary/anonymous drafts)
create table if not exists drafts (
  id uuid primary key default uuid_generate_v4(),
  title text,
  content text not null,
  source text,
  created_at timestamptz default now()
);

-- User usage table (for internal usage tracking)
-- Tracks edit counts for monitoring and potential rate limiting
create table if not exists user_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  edit_count integer default 0,
  daily_reset_date date default current_date,
  monthly_edit_count integer default 0,
  monthly_reset_date date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================

create index if not exists projects_user_id_idx on projects(user_id);
create index if not exists documents_owner_id_idx on documents(owner_id);
create index if not exists documents_project_id_idx on documents(project_id);
create index if not exists document_versions_document_id_idx on document_versions(document_id);
create index if not exists files_project_id_idx on files(project_id);
create index if not exists files_url_idx on files(url);
create index if not exists user_usage_user_id_idx on user_usage(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
alter table projects enable row level security;
alter table documents enable row level security;
alter table document_versions enable row level security;
alter table files enable row level security;
alter table drafts enable row level security;
alter table user_usage enable row level security;

-- Projects policies
create policy "Users can view their own projects"
  on projects for select
  using (auth.uid() = user_id);

create policy "Users can create their own projects"
  on projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on projects for delete
  using (auth.uid() = user_id);

-- Documents policies
create policy "Users can view their own documents"
  on documents for select
  using (auth.uid() = owner_id or is_public = true);

create policy "Users can create their own documents"
  on documents for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own documents"
  on documents for update
  using (auth.uid() = owner_id);

create policy "Users can delete their own documents"
  on documents for delete
  using (auth.uid() = owner_id);

-- Document versions policies
create policy "Users can view versions of their documents"
  on document_versions for select
  using (
    exists (
      select 1 from documents
      where documents.id = document_versions.document_id
      and documents.owner_id = auth.uid()
    )
  );

create policy "Users can create versions of their documents"
  on document_versions for insert
  with check (
    exists (
      select 1 from documents
      where documents.id = document_versions.document_id
      and documents.owner_id = auth.uid()
    )
  );

-- Files policies
create policy "Users can view files in their projects"
  on files for select
  using (
    exists (
      select 1 from projects
      where projects.id = files.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can create files in their projects"
  on files for insert
  with check (
    exists (
      select 1 from projects
      where projects.id = files.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can update files in their projects"
  on files for update
  using (
    exists (
      select 1 from projects
      where projects.id = files.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete files in their projects"
  on files for delete
  using (
    exists (
      select 1 from projects
      where projects.id = files.project_id
      and projects.user_id = auth.uid()
    )
  );

-- Drafts policies (public access for anonymous drafts)
create policy "Anyone can view drafts"
  on drafts for select
  using (true);

create policy "Anyone can create drafts"
  on drafts for insert
  with check (true);

-- User usage policies
create policy "Users can view their own usage"
  on user_usage for select
  using (auth.uid() = user_id);

create policy "Users can insert their own usage"
  on user_usage for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own usage"
  on user_usage for update
  using (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to increment edit count
create or replace function increment_edit_count(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  current_edit_count integer;
  current_monthly_count integer;
  edit_limit integer := 2147483647; -- Effectively unlimited. Change to enforce limits.
begin
  -- Get or create user usage record
  insert into user_usage (user_id, edit_count, daily_reset_date, monthly_edit_count, monthly_reset_date)
  values (p_user_id, 0, current_date, 0, date_trunc('month', current_date)::date)
  on conflict (user_id) do nothing;

  -- Get current counts
  select edit_count, monthly_edit_count
  into current_edit_count, current_monthly_count
  from user_usage
  where user_id = p_user_id;

  -- Check if user has reached limit
  if current_monthly_count >= edit_limit then
    return false;
  end if;

  -- Update with reset logic
  update user_usage
  set
    -- Reset daily count if new day
    edit_count = case
      when daily_reset_date < current_date then 1
      else edit_count + 1
    end,
    daily_reset_date = current_date,
    -- Reset monthly count if new month
    monthly_edit_count = case
      when monthly_reset_date < date_trunc('month', current_date)::date then 1
      else monthly_edit_count + 1
    end,
    monthly_reset_date = date_trunc('month', current_date)::date,
    updated_at = now()
  where user_id = p_user_id;

  return true;
end;
$$;

-- Function to get document with collaborators (placeholder)
create or replace function get_document_with_collaborators(doc_id uuid)
returns table (
  id uuid,
  title text,
  content text,
  document_type text,
  is_public boolean,
  owner_id uuid,
  owner_name text,
  collaborators jsonb
)
language plpgsql
security definer
as $$
begin
  return query
  select
    d.id,
    d.title,
    d.content,
    d.document_type,
    d.is_public,
    d.owner_id,
    coalesce(u.raw_user_meta_data->>'full_name', u.email) as owner_name,
    '[]'::jsonb as collaborators
  from documents d
  left join auth.users u on u.id = d.owner_id
  where d.id = doc_id;
end;
$$;

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create storage bucket for project files (named 'lars' as expected by the app)
insert into storage.buckets (id, name, public)
values ('lars', 'lars', true)
on conflict (id) do nothing;

-- Storage policies for lars bucket
-- Path format: projects/{project_id}/filename
-- For simplicity in local development, allow authenticated users full access

create policy "Authenticated users can view files"
  on storage.objects for select
  using (bucket_id = 'lars' and auth.role() = 'authenticated');

create policy "Authenticated users can upload files"
  on storage.objects for insert
  with check (bucket_id = 'lars' and auth.role() = 'authenticated');

create policy "Authenticated users can update files"
  on storage.objects for update
  using (bucket_id = 'lars' and auth.role() = 'authenticated');

create policy "Authenticated users can delete files"
  on storage.objects for delete
  using (bucket_id = 'lars' and auth.role() = 'authenticated');

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_projects_updated_at
  before update on projects
  for each row execute function update_updated_at_column();

create trigger update_documents_updated_at
  before update on documents
  for each row execute function update_updated_at_column();

create trigger update_user_usage_updated_at
  before update on user_usage
  for each row execute function update_updated_at_column();
