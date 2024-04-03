import { ContextApi } from "@pancakeswap/localization";
import { FooterLinkType } from "../../../components/Footer/types";

export const footerLinks: (t: ContextApi["t"]) => FooterLinkType[] = (t) => [
  {
    label: t("Ecosystem"),
    items: [
      {
        label: t("Trade"),
        href: "/swap",
      },
      {
        label: t("Earn"),
        href: "/farms",
      },
      {
        label: t("Tokenomics"),
        href: "/",
      },
      {
        label: t("Litepaper"),
        href: "/",
      },
    ],
  },
  {
    label: t("Developers"),
    items: [
      {
        label: t("Contributing"),
        href: "/",
      },
      {
        label: t("Github"),
        href: "/",
      },
      {
        label: t("Bug Bounty"),
        href: "/",
      },
    ],
  },
  {
    label: t("Support"),
    items: [
      {
        label: t("Contact"),
        href: "/",
      },
      {
        label: t("Troubleshooting"),
        href: "/",
      },
      {
        label: t("Documentation"),
        href: "/",
      },
    ],
  },
  {
    label: t("About"),
    items: [
      {
        label: t("Terms Of Service"),
        href: "/",
      },
      {
        label: t("Blog"),
        href: "/",
      },
      {
        label: t("Brand Assets"),
        href: "/",
      },
      {
        label: t("Careers"),
        href: "/",
      },
    ],
  },
];
