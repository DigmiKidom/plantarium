import { PageSkeleton } from "@/components/ui/page-skeleton";

// Loading skeletons only on personal pages: on public pages a loading boundary would turn
// "not found" into a 200 response (streaming starts first), which search engines treat as a soft 404.
export default PageSkeleton;
