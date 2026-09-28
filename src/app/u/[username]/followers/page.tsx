import { FollowListPage } from "@/components/follow/follow-list-page";

export const metadata = { title: "עוקבים" };
export const dynamic = "force-dynamic";

export default async function FollowersPage({ params }: PageProps<"/u/[username]/followers">) {
  return <FollowListPage username={(await params).username.toLowerCase()} kind="followers" />;
}
