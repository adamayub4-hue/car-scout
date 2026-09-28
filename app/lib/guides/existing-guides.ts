import type { Guide } from "./types";

export const existingGuides: Guide[] = [
  {
    slug: "buying-a-used-car",
    title: "Buying a used car: a practical UK checklist",
    description:
      "Plan a used-car purchase, check DVLA and MOT records, inspect the paperwork and arrange insurance and tax before collection.",
    intro: [
      "A useful shortlist contains more than attractive photographs and an affordable asking price. Before paying, you need to understand which vehicle is being offered, what its records show, what needs checking in person and how you will collect it. This guide takes you through those decisions in an order that avoids unnecessary journeys.",
      "The linked GOV.UK pages explain official checks and requirements. The comparison notes, questions and viewing plan below are Mekivo's practical suggestions. They cannot establish a vehicle's condition or replace an independent inspection. Mekivo helps you reach marketplace searches; it does not inspect cars or verify their sellers.",
    ],
    sections: [
      {
        id: "prepare-a-shortlist",
        title: "Start with a budget and a small shortlist",
        paragraphs: [
          "Write down your maximum purchase price and leave a separate amount for collection, insurance, tax and any work identified during inspection. Get an insurance quote for a specific candidate before deciding that its price fits your budget. GOV.UK explains that insurance is required for driving on UK roads; the advertised price does not cover that responsibility.",
          "For each candidate, save the original listing, asking price, advertised mileage, seller details and the date you checked it. Compare a few cars that meet the same needs rather than treating the cheapest advert as the best purchase. Note what would make you reject a car: missing information, unresolved faults or costs that leave no room for essential work.",
        ],
        sourceIds: ["insurance"],
      },
      {
        id: "check-vehicle-records",
        title: "Check the identity before travelling",
        paragraphs: [
          "Ask for the registration, make, model and MOT information before arranging a viewing. DVLA's vehicle enquiry service provides recorded details including manufacture year, first registration, engine size, fuel type and tax status. Compare those records with the advert, and ask the seller to explain any mismatch before you spend time travelling.",
          "Keep your questions specific: which detail differs, what does the seller believe is correct, and what paperwork supports that answer? A vague assurance that an advert contains a typo is less useful than an explanation you can check. Record unresolved questions beside the listing. A government record is one part of your checks, not a valuation or a report on the seller's honesty.",
        ],
        sourceIds: ["dvla-information", "used-vehicle-checks"],
      },
      {
        id: "read-mot-history",
        title: "Read the MOT history as a sequence",
        paragraphs: [
          "The official MOT history service shows test outcomes, recorded mileage and the next due date. For tests in Great Britain, it also provides details of failed items and recorded minor problems. Available history differs by vehicle type and location: the service describes separate coverage for Northern Ireland. Use the registration to open the correct record.",
          "Read several entries together and make a short list of issues to discuss. Ask what work followed a failure and whether there are invoices or other records. If a mileage entry looks inconsistent, ask about that particular entry rather than assuming the explanation. Bring these notes to the viewing so that a recent pass does not distract you from earlier questions about maintenance or repairs.",
        ],
        sourceIds: ["mot-history"],
      },
      {
        id: "check-recalls",
        title: "Look for outstanding safety recalls",
        paragraphs: [
          "GOV.UK provides a safety-recall check and explains that the manufacturer handles affected vehicles. Recall repairs or replacement parts are usually free. If a serious safety defect applies, follow the manufacturer's instructions; GOV.UK says not to drive a vehicle with such a defect. Do this check before planning a test drive or collection.",
          "Ask the seller about any recall that appears and request evidence of completed work where relevant. Keep the recall question separate from a general service-history discussion: an invoice for routine servicing may not answer it. If the status remains unclear, contact the manufacturer with the vehicle details and establish the next step before committing to travel or payment.",
        ],
        sourceIds: ["recalls"],
      },
      {
        id: "view-paperwork",
        title: "Match the car to its paperwork",
        paragraphs: [
          "At the viewing, ask to see the V5C registration certificate. GOV.UK advises checking its authenticity and matching the vehicle identification number and engine number against the document. Its used-vehicle checklist includes the watermark and suspicious serial-number guidance. Open that official checklist when inspecting the document rather than relying on a remembered example.",
          "Compare the paperwork with the details you saved before travelling. Ask for an explanation if the person selling the car, collection location or supporting records differ from what you expected. Request service documents and the records for work mentioned in the advert. Do not fill a gap with an assumption simply because the car looks tidy or another buyer is supposedly waiting.",
        ],
        sourceIds: ["used-vehicle-checks"],
      },
      {
        id: "inspect-condition",
        title: "Use the viewing to decide what needs an expert",
        paragraphs: [
          "GOV.UK makes clear that a current MOT does not guarantee a car remains safe. Its roadworthiness guidance covers lights, brakes, visibility, tyres and checks described in the vehicle handbook. Use those categories to organise your viewing, while remembering that a casual inspection cannot establish every mechanical or electrical issue.",
          "Allow enough time to look around the car, read its handbook where available and try the ordinary controls with the seller. Note visible damage, warning messages and anything that does not work as described. Ask about each concern instead of attempting a repair. If you cannot judge the answer, arrange an independent mechanic or inspection service and agree who will pay before proceeding.",
        ],
        sourceIds: ["roadworthiness"],
      },
      {
        id: "plan-test-drive",
        title: "Agree a test drive before taking the keys",
        paragraphs: [
          "Do not assume that your existing insurance covers driving another person's car. Confirm the actual arrangement with the insurer or dealer before a road test. GOV.UK's insurance guidance explains the requirement for motor insurance; permission from the seller alone is not confirmation that you have the required cover.",
          "Agree a sensible route and ask the seller how any unfamiliar controls work before moving. During the drive, pay attention to comfort, visibility, warning messages and anything that concerns you. Stop safely if you are worried about the car. Describe observations to a mechanic in plain terms instead of turning a noise or vibration into an unsupported diagnosis. A refused or unsuitable test drive is a reason to reconsider the purchase.",
        ],
        sourceIds: ["insurance"],
      },
      {
        id: "payment-and-collection",
        title: "Finish the checks before payment and collection",
        paragraphs: [
          "Agree the final price, included items and any promised work in writing. Ask for a dated receipt identifying the vehicle, seller, buyer and amount paid. Keep the advert and messages with it. Resolve collection arrangements before transferring money, including what happens if agreed repairs or documents are not ready.",
          "The official tax service allows a new keeper to tax a vehicle using the green slip from its V5C. Arrange tax and insurance before driving away, and complete the applicable DVLA registration process. If you cannot complete an essential step, change the collection plan rather than assuming it can wait until you get home.",
        ],
        sourceIds: ["vehicle-tax", "used-vehicle-checks"],
      },
    ],
    sources: [
      { id: "used-vehicle-checks", title: "GOV.UK: Check a used vehicle you are buying", url: "https://www.gov.uk/checks-when-buying-a-used-car" },
      { id: "dvla-information", title: "GOV.UK: Get vehicle information from DVLA", url: "https://www.gov.uk/get-vehicle-information-from-dvla" },
      { id: "mot-history", title: "GOV.UK: Check the MOT history of a vehicle", url: "https://www.gov.uk/check-mot-history" },
      { id: "recalls", title: "GOV.UK: Check if a vehicle, part or accessory has been recalled", url: "https://www.gov.uk/check-vehicle-recall" },
      { id: "roadworthiness", title: "GOV.UK: Check your vehicle is safe to drive", url: "https://www.gov.uk/check-vehicle-safe" },
      { id: "insurance", title: "GOV.UK: Vehicle insurance", url: "https://www.gov.uk/vehicle-insurance" },
      { id: "vehicle-tax", title: "GOV.UK: Tax your vehicle", url: "https://www.gov.uk/vehicle-tax" },
    ],
    publishedAt: "2026-08-25",
    updatedAt: "2026-09-28",
    category: "cars",
    relatedSlugs: ["checking-mot-history", "checking-v5c-logbook", "avoiding-used-car-scams"],
  },
  {
    slug: "finding-the-right-car-part",
    title: "How to find the right car part",
    description:
      "Turn a repair requirement into a clear parts search, compare seller information and gather the evidence needed to check fitment.",
    intro: [
      "A good parts search starts with a clear description of what you need. It ends with a supplier or garage checking the actual replacement against your vehicle. Treat the listings in between as candidates. Finding a familiar name or matching photograph is useful, but it is not the same as confirming that an item is suitable.",
      "This guide combines official UK safety and buying information with Mekivo's suggested search workflow. GOV.UK is not a vehicle fitment catalogue and does not validate individual part numbers. Mekivo's generic visual guide helps with component names; it is not a diagnosis, an OEM diagram system or a promise that a listed part will fit.",
    ],
    sections: [
      {
        id: "define-the-job",
        title: "Describe the job before searching for a product",
        paragraphs: [
          "Start with what has actually been established. Write down the symptom, any inspection findings and the component a garage has identified. Keep an uncertain diagnosis labelled as uncertain. GOV.UK's safety guidance places responsibility on the driver to keep the vehicle roadworthy, so buying a part is not a substitute for finding out whether the vehicle is safe to use.",
          "If a garage will carry out the repair, ask it to confirm what should be ordered before you shop. Agree whether it is willing to fit a customer-supplied item and what its quotation includes. A useful brief might describe the job, the required position and the information still missing. That is more actionable than a broad search based only on an unfamiliar noise.",
        ],
        sourceIds: ["roadworthiness"],
      },
      {
        id: "record-vehicle-details",
        title: "Put the vehicle details in one place",
        paragraphs: [
          "Record the registration, make, model and details requested by the supplier. The DVLA enquiry service can help check recorded engine size, fuel type, manufacture year and first-registration date. These are useful identification details; the service does not provide a list of compatible replacement products.",
          "Add what you know from the vehicle's documents and repair records, without guessing missing specifications. If a supplier requests a VIN or additional vehicle information, use its direct contact channel rather than posting documents publicly. Ask which particular information it needs. Keep the same vehicle brief for each enquiry so that apparently conflicting seller answers can be compared against identical information.",
        ],
        sourceIds: ["dvla-information"],
      },
      {
        id: "collect-identifiers",
        title: "Photograph labels and ask what each number means",
        paragraphs: [
          "If the existing component is safely accessible, photograph its label and location without dismantling anything. Copy visible text exactly, including letters, spaces and punctuation, into your notes. If several numbers appear, keep them all with the photographs and ask the supplier or garage which reference identifies the replacement you need.",
          "Avoid assuming that every stamped marking is an orderable part number or that a changed letter proves an item is equivalent. GOV.UK's counterfeit-parts guidance notes that cars sharing a model and year can still need different components. Use the identifiers to ask a precise question, not to skip confirmation. If you cannot read a number, tell the supplier that it is uncertain rather than silently substituting a character.",
        ],
        sourceIds: ["fake-parts"],
      },
      {
        id: "build-a-search",
        title: "Search narrowly, then widen one detail at a time",
        paragraphs: [
          "Once a supplier or garage has identified a usable reference, try that complete reference in the parts search. Without one, begin with the component name and confirmed vehicle information. If the results are poor, change one term at a time and keep a note of what changed. This makes it easier to recognise whether an extra word improves relevance or removes useful candidates.",
          "Open the original listing and record the exact item offered, its stated condition and the seller's contact details. GOV.UK's distance-selling guidance requires relevant business sellers to provide clear product, price and delivery information. Treat missing information as a question for the seller, not an invitation to infer that every photographed accessory is included.",
        ],
        sourceIds: ["distance-selling"],
      },
      {
        id: "compare-candidates",
        title: "Compare the complete purchase, not just the headline price",
        paragraphs: [
          "Make a small comparison containing the item reference, stated condition, included pieces, total delivered price, expected arrival and unanswered questions. Ask whether the photographs show the item being supplied and request clarification where the description is ambiguous. GOV.UK's business guidance covers disclosure of delivery charges and arrangements, giving you a useful starting point for those questions.",
          "Read seller information as carefully as the product description. The government's counterfeit-parts advice warns that appearance and packaging can be misleading. A low price or a polished picture cannot establish authenticity. If the seller cannot explain the source of a branded item, ask the manufacturer, a recognised distributor or your garage for help before choosing it.",
        ],
        sourceIds: ["distance-selling", "fake-parts"],
      },
      {
        id: "check-safety-information",
        title: "Check relevant recalls before placing an order",
        paragraphs: [
          "The government recall service covers parts and accessories as well as vehicles. For a part or accessory search, it asks for the manufacturer and model. Keep those details from the listing or packaging so you can check the relevant product rather than searching only for the car's name.",
          "If a recall appears relevant, ask the supplier or manufacturer whether the particular item is affected and what action is required. Do not interpret an unfamiliar batch description yourself. Save the response with your comparison notes. If the problem you are trying to repair might relate to an existing vehicle recall, establish that position before paying for a separate replacement.",
        ],
        sourceIds: ["recalls"],
      },
      {
        id: "understand-return-options",
        title: "Understand cancellation and returns before ordering",
        paragraphs: [
          "For qualifying online consumer purchases from a business, GOV.UK explains a cancellation period of 14 days after receipt, followed by another 14 days to return the goods. Exceptions apply, including some made-to-order products. Faulty or misdescribed goods raise different issues from simply changing your mind. Do not assume a private seller offers the same cancellation arrangement.",
          "Ask how to report an incorrect item, where it must be returned and how delivery costs are handled. Read the current terms rather than relying on a general marketplace badge. Avoid fitting, modifying or damaging a doubtful part while trying to decide whether to return it. If a seller's answer appears to conflict with your rights, use the consumer-advice routes listed by GOV.UK.",
        ],
        sourceIds: ["returns", "consumer-rights"],
      },
      {
        id: "handover-and-records",
        title: "Give the fitter the evidence, not just a parcel",
        paragraphs: [
          "Save the final listing, receipt, part details and written compatibility response together. On delivery, compare the package and supplied item with that order record before handing them over for fitting. If the reference, quantity or description differs, ask the seller to resolve the discrepancy. A replacement parcel should be checked again rather than assumed correct.",
          "Give the garage your vehicle brief and the seller's response so it can review the actual item. GOV.UK provides routes for reporting serious safety defects to the manufacturer and, where its response is unsatisfactory, DVSA. Retaining the product identity and purchase record helps you explain a later problem accurately. Mekivo can help you find candidates; the final purchase and fitment decision still needs this evidence.",
        ],
        sourceIds: ["safety-defect"],
      },
    ],
    sources: [
      { id: "dvla-information", title: "GOV.UK: Get vehicle information from DVLA", url: "https://www.gov.uk/get-vehicle-information-from-dvla" },
      { id: "fake-parts", title: "GOV.UK: Consumer guidance on fake vehicle parts", url: "https://www.gov.uk/government/publications/counterfeit-vehicle-parts/consumer-guidance-fake-parts" },
      { id: "roadworthiness", title: "GOV.UK: Check your vehicle is safe to drive", url: "https://www.gov.uk/check-vehicle-safe" },
      { id: "distance-selling", title: "GOV.UK: Online and distance selling", url: "https://www.gov.uk/online-and-distance-selling-for-businesses" },
      { id: "recalls", title: "GOV.UK: Check if a vehicle, part or accessory has been recalled", url: "https://www.gov.uk/check-vehicle-recall" },
      { id: "returns", title: "GOV.UK: Accepting returns and giving refunds", url: "https://www.gov.uk/accepting-returns-and-giving-refunds" },
      { id: "consumer-rights", title: "GOV.UK: Consumer rights and advice", url: "https://www.gov.uk/consumer-protection-rights" },
      { id: "safety-defect", title: "GOV.UK: Report a serious vehicle safety defect", url: "https://www.gov.uk/vehicle-recalls-and-faults/report-a-serious-safety-defect" },
    ],
    publishedAt: "2026-08-25",
    updatedAt: "2026-09-28",
    category: "parts",
    relatedSlugs: ["reading-car-part-numbers", "checking-part-compatibility"],
  },
  {
    slug: "checking-part-compatibility",
    title: "How to check whether a car part fits",
    description:
      "Check vehicle details, supplier references, listing exclusions and written fitment evidence before buying or fitting a replacement car part.",
    intro: [
      "Compatibility is a question about a particular replacement and a particular vehicle. A listing can contain the right model name and still leave important questions unanswered. The aim of this guide is to help you gather those answers, keep track of their source and recognise when you need a supplier, manufacturer or qualified garage to decide.",
      "GOV.UK supports the official safety and consumer information linked below. It is not a technical fitment catalogue. The comparison method is Mekivo's practical workflow, not government approval of a product. Mekivo does not certify part numbers, manufacturer substitutions or the suitability of marketplace listings. A generic illustration can help name a component but cannot settle these questions.",
    ],
    sections: [
      {
        id: "define-the-comparison",
        title: "Separate vehicle identity, product identity and seller claims",
        paragraphs: [
          "Create three short notes: what is known about your vehicle, which item is being offered, and what the seller says connects the two. GOV.UK's counterfeit-parts guidance highlights that the same model and year can require different parts. That makes a broad model match a starting point for questions rather than a completed compatibility check.",
          "Keep facts and assumptions separate. A registration copied from your documents belongs in the first note; a number copied from a listing belongs in the second; an answer from the supplier belongs in the third. Where information conflicts, ask which record the answer relies on. Do not resolve a contradiction by selecting whichever detail makes the cheaper item appear suitable.",
        ],
        sourceIds: ["fake-parts"],
      },
      {
        id: "confirm-vehicle-configuration",
        title: "Check the vehicle details and disclose known changes",
        paragraphs: [
          "Use the DVLA enquiry service to cross-check recorded vehicle information, then give the supplier any further details it requests. Keep a record of known changes rather than assuming the car remains exactly as originally supplied. Ask the garage which changes matter to the proposed repair; a registration lookup alone cannot answer every question about the vehicle in front of it.",
          "DVLA requires evidence for certain changes to registration details, including engine number or capacity changes. Its guidance lists acceptable evidence and separate requirements for structural changes. If your project involves those areas, read that guidance before ordering and keep the relevant records. Ordinary replacement shopping should not be confused with a decision about vehicle registration or approval.",
        ],
        sourceIds: ["dvla-information", "vehicle-changes"],
      },
      {
        id: "verify-part-references",
        title: "Ask the supplier to explain reference numbers",
        paragraphs: [
          "Copy the reference from the proposed item and compare it with the information supplied by your garage or manufacturer. If they differ, ask for a written explanation tied to your vehicle and that exact product. If a seller says one number replaces another, request the manufacturer or catalogue evidence behind the claim. Do not infer a substitution from similar numbering.",
          "Keep photographs of labels alongside the text so that someone checking the enquiry can see what you copied. Ask about unreadable characters rather than filling them in. The official counterfeit-parts advice recommends expert help where uncertainty remains; it does not provide a rule that any particular prefix, suffix or stamped marking proves compatibility. Treat those details as evidence to investigate, not a universal code you can decode yourself.",
        ],
        sourceIds: ["fake-parts"],
      },
      {
        id: "read-the-exact-offer",
        title: "Read exclusions and confirm what will arrive",
        paragraphs: [
          "Read the whole original listing, including notes beneath a compatibility table. Ask the seller to address any exclusion that might apply to your vehicle. Confirm the exact product, stated condition, quantity and included items rather than relying on the title alone. A conversation about a similar product is not confirmation of the item in your basket.",
          "GOV.UK's distance-selling guidance explains the information a relevant business seller must provide, including a product description, price and delivery arrangements. Use the order record to capture those details. A practical message is: these are my vehicle details, this is your listing reference, and this is the point I need you to confirm. Keep the response attached to that order rather than a separate, unlabelled screenshot.",
        ],
        sourceIds: ["distance-selling"],
      },
      {
        id: "review-safety-and-recalls",
        title: "Check safety information as well as the fitment answer",
        paragraphs: [
          "A supplier's compatibility answer does not replace a recall check. GOV.UK lets you search recalls for components and accessories using the manufacturer and model. If the result appears relevant, ask the manufacturer whether the actual product or batch is affected. Keep any instructions with the purchase record.",
          "Separate the questions you are asking. One concerns whether the product is intended for your vehicle; another concerns whether the supplied item is affected by a known safety problem. If you cannot identify the product well enough to ask either question, resolve that gap before fitting it. Do not treat the absence of an obvious result as a certificate that the item is authentic or safe.",
        ],
        sourceIds: ["recalls"],
      },
      {
        id: "check-before-fitting",
        title: "Have differences resolved before fitting",
        paragraphs: [
          "When the item arrives, compare it with the order confirmation and ask the fitter to review it before installation. Photographs, dimensions and visible connections can help explain a concern, but this guide does not give a technical pass or fail rule for them. Do not force, alter or dismantle a questionable item to make the purchase seem workable.",
          "Ask who will confirm suitability and whether any additional work or checks are included in the fitting quotation. GOV.UK says a vehicle can be unsafe even with a valid MOT; an MOT should therefore not be used to settle a question about a proposed replacement. If the fitter and seller disagree, pause the job and obtain a clear explanation rather than passing the uncertainty between them.",
        ],
        sourceIds: ["roadworthiness"],
      },
      {
        id: "handle-a-mismatch",
        title: "Keep cancellation, mismatch and fault questions separate",
        paragraphs: [
          "If the delivered item differs from the order or the seller's written description, document the difference and contact the seller promptly. Describe what you received and the remedy you are asking for. Do not simply label every problem as a change of mind: the facts of the purchase matter.",
          "GOV.UK distinguishes cancellation of qualifying distance purchases from remedies for faulty or misdescribed goods. It also explains that business sellers cannot remove statutory consumer rights through a blanket no-refunds policy. Read the guidance applicable to your purchase and get consumer advice if necessary. Keep packaging and avoid unnecessary handling while you establish what to do; a seller's return procedure does not itself prove that the part was compatible.",
        ],
        sourceIds: ["returns", "consumer-rights"],
      },
      {
        id: "retain-evidence",
        title: "Keep a record that another person can follow",
        paragraphs: [
          "Store the vehicle details used for the check, the precise product reference, original listing, invoice and supplier confirmation together. Add the fitting invoice and any explanation of a replacement or changed product. This creates a useful record for a future garage visit without needing to reconstruct the decision from search history.",
          "For a serious safety defect, GOV.UK advises reporting it to the manufacturer immediately and contacting DVSA if you are unhappy with the response. Its reporting process asks for vehicle details and information about what happened. Keep observations factual and retain photographs where available. A good compatibility decision has a traceable basis; an unresolved claim should remain a question, even after a parcel has arrived.",
        ],
        sourceIds: ["safety-defect"],
      },
    ],
    sources: [
      { id: "fake-parts", title: "GOV.UK: Consumer guidance on fake vehicle parts", url: "https://www.gov.uk/government/publications/counterfeit-vehicle-parts/consumer-guidance-fake-parts" },
      { id: "dvla-information", title: "GOV.UK: Get vehicle information from DVLA", url: "https://www.gov.uk/get-vehicle-information-from-dvla" },
      { id: "vehicle-changes", title: "GOV.UK: Evidence for changing vehicle registration details", url: "https://www.gov.uk/change-vehicle-details-registration-certificate/what-evidence-to-give" },
      { id: "distance-selling", title: "GOV.UK: Online and distance selling", url: "https://www.gov.uk/online-and-distance-selling-for-businesses" },
      { id: "recalls", title: "GOV.UK: Check if a vehicle, part or accessory has been recalled", url: "https://www.gov.uk/check-vehicle-recall" },
      { id: "roadworthiness", title: "GOV.UK: Check your vehicle is safe to drive", url: "https://www.gov.uk/check-vehicle-safe" },
      { id: "returns", title: "GOV.UK: Accepting returns and giving refunds", url: "https://www.gov.uk/accepting-returns-and-giving-refunds" },
      { id: "consumer-rights", title: "GOV.UK: Consumer rights and advice", url: "https://www.gov.uk/consumer-protection-rights" },
      { id: "safety-defect", title: "GOV.UK: Report a serious vehicle safety defect", url: "https://www.gov.uk/vehicle-recalls-and-faults/report-a-serious-safety-defect" },
    ],
    publishedAt: "2026-08-25",
    updatedAt: "2026-09-28",
    category: "parts",
    relatedSlugs: ["finding-the-right-car-part", "reading-car-part-numbers"],
  },
];
