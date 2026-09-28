import { FollowListPage } from "@/components/follow/follow-list-page";

export const metadata = { title: "במעקב" };
export const dynamic = "force-dynamic";

export default async function FollowingPage({ params }: PageProps<"/u/[username]/following">) {
  return <FollowListPage username={(await params).username.toLowerCase()} kind="following" />;
}
