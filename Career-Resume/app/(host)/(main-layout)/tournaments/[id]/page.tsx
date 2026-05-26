import Cta from "@/components/home/Cta";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";
import Details from "@/components/tournaments/Details";
import { tournamentData } from "@/public/data/tournamentData";

export async function generateStaticParams() {
  return tournamentData.map((tournament) => ({
    id: tournament.id.toString(),
  }));
}

const page = ({ params }: { params: { id: string } }) => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Tournament Details" />
      <Details id={params.id} />
      <Cta />
    </main>
  );
};

export default page;
