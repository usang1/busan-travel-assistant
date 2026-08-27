drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can create own user profile" on public.profiles;
create policy "Users can create own user profile"
on public.profiles for insert
with check (id = auth.uid() and role = 'user');

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update own non-role profile fields" on public.profiles;
create policy "Users can update own non-role profile fields"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and role = 'user');

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "MVP admin can manage photo spots" on public.photo_spots;
drop policy if exists "Admins can manage photo spots" on public.photo_spots;
create policy "Admins can manage photo spots"
on public.photo_spots for all
using (public.is_admin())
with check (public.is_admin());
