/**
 * The deployment ceiling, stated once for every long-form content page.
 *
 * The copy in this library explains the whole protocol, including levels nobody can
 * obtain today. That is legitimate only while every page says, in the same words, what
 * the reference deployment actually issues. ContentArticle renders this on every page
 * unconditionally, and test/content.test.ts asserts the renderer still does — a
 * disclosure a future author can forget is one a future author will forget.
 */
export const DEPLOYMENT_CEILING =
  "The reference deployment at agenid.com issues DECLARED and L1_REGISTERED only. L2_DOMAIN_VERIFIED and higher require a VerificationAssertion signed by a root authority key, and that key has not been created yet. L5 is reserved by the specification and is not issuable at all.";

export const IDENTITY_IS_NOT_PERMISSION =
  "Which agent is acting and who declared it is one question. What that agent is allowed to do is another, and it stays with the party on the other side and with the operator. Protocol v1.1.1 defines no signed authorization object.";
