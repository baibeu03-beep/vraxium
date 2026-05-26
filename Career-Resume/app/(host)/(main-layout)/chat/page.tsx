import Chat from "@/components/pages/Chat";
import Animations from "@/components/shared/Animations";
import Breadcrumb from "@/components/shared/Breadcrumb";

const page = () => {
  return (
    <main className="nftg-content">
      <Animations />
      <Breadcrumb title="Chat" />
      <Chat />
    </main>
  );
};

export default page;
