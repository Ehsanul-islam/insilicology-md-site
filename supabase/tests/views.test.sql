-- The app's TypeScript row types (src/lib/data/map.ts) mirror these views. If this test fails you
-- changed a view: update the types, then run `npm run db:fixtures`.
do $$
declare
  cols text;
begin
  select string_agg(column_name, ',' order by ordinal_position) into cols
    from information_schema.columns where table_schema = 'public' and table_name = 'public_records';
  perform t.is(cols, 'id,slug,title,description,type_slug,type_name,pdb_id,protein_name,molecules,software,software_version,force_field,length_ns,replicas,methodology,authors,doi,paper_url,citation_bibtex,license,project,tags,files,contributor,published_at,updated_at,sim_type_slug,sim_type_name', 'public_records columns');
  select string_agg(column_name, ',' order by ordinal_position) into cols
    from information_schema.columns where table_schema = 'public' and table_name = 'published_pdbs';
  perform t.is(cols, 'pdb_id,protein_name,complexes,ligands', 'published_pdbs columns');
  select string_agg(column_name, ',' order by ordinal_position) into cols
    from information_schema.columns where table_schema = 'public' and table_name = 'public_posts';
  perform t.is(cols, 'id,slug,title,excerpt,content_md,featured_image_path,category_slug,category_name,tags,refs,author_name,published_at,updated_at', 'public_posts columns');
end $$;
