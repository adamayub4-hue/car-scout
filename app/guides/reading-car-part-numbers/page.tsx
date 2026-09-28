import GuideArticle from "../../components/guide-article";
import { getGuide } from "../../lib/guides";
import { guideMetadata } from "../../lib/guides/metadata";

const guide = getGuide("reading-car-part-numbers");
export const metadata = guideMetadata(guide);

export default function Page() {
  return <GuideArticle guide={guide} />;
}
