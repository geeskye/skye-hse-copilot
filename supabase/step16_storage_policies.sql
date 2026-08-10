-- SKYE HSE COPILOT — STEP 16
-- Secure company-document Storage policies
--
-- Required object path:
--   company-documents/<COMPANY_ID>/<DOCUMENT_ID>/<filename>
--
-- Tenant isolation rule:
--   The first path segment is the company UUID.
--   A user may only INSERT / UPDATE / DELETE objects when
--   is_company_member(<COMPANY_ID>) returns true.
--
-- Existing STEP 15A Storage SELECT/RLS policy is intentionally not changed here.

-- INSERT: company members may upload only into their own company folder.
drop policy if exists "company members can upload company documents"
  on storage.objects;

create policy "company members can upload company documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'company-documents'
  and is_company_member(split_part(name, '/', 1)::uuid)
);

-- UPDATE: company members may modify only objects belonging to their company.
drop policy if exists "company members can update company documents"
  on storage.objects;

create policy "company members can update company documents"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'company-documents'
  and is_company_member(split_part(name, '/', 1)::uuid)
)
with check (
  bucket_id = 'company-documents'
  and is_company_member(split_part(name, '/', 1)::uuid)
);

-- DELETE: company members may delete only objects belonging to their company.
drop policy if exists "company members can delete company documents"
  on storage.objects;

create policy "company members can delete company documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'company-documents'
  and is_company_member(split_part(name, '/', 1)::uuid)
);

-- IMPORTANT:
-- Do not make the bucket public.
-- Do not add policies using only auth.uid() without checking company membership.
-- Do not allow a user to select another company's folder by changing COMPANY_ID.
