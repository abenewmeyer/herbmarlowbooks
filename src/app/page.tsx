import Workspace from "@/components/Workspace";
import { supabaseServer } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { data } = await (await supabaseServer()).auth.getUser();
  return <Workspace email={data.user?.email ?? ""} />;
}
