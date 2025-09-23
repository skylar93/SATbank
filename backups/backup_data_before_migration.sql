SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."warehouses" ("id", "name", "type", "created_at", "name_ko") VALUES
	('550e8400-e29b-41d4-a716-446655440000', 'Gomax Trading Corp', 'Main', '2025-08-22 05:06:03.21972+00', '고맥스 트레이딩'),
	('550e8400-e29b-41d4-a716-446655440001', 'Test Consignment Store', 'Consignment', '2025-08-22 05:06:03.22669+00', '테스트 위탁점');


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."products" ("id", "sku", "barcode", "name_ko", "name_en", "vendor", "tax_rate", "parent_product_id", "unit_quantity", "status", "created_at", "type", "notes", "vendor_id", "cost_price", "safety_stock_quantity", "unit_price") VALUES
	('660e8400-e29b-41d4-a716-446655440000', 'TEST-001', NULL, '테스트 상품 1', 'Test Product 1', NULL, 0.13, NULL, 1, 'Active', '2025-08-22 05:06:03.227598+00', NULL, NULL, NULL, 0, 5, 0),
	('25caef77-40fc-47b2-b925-18ba8c483c5f', 'GO053', '8805854234005', '티타늄 명월 수저 2세트', 'Titanium Luminous Moon Spoon & Chopsticks 2p Set', '퀸센스', 0.13, NULL, 1, 'Active', '2025-08-28 14:17:35.087993+00', NULL, NULL, NULL, 0, 5, 0);


--
-- Data for Name: customer_specific_prices; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inventory" ("product_id", "warehouse_id", "quantity", "last_updated_at") VALUES
	('660e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', 85, '2025-08-22 05:06:03.244085+00'),
	('660e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', 80, '2025-08-22 05:06:23.953949+00');


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: invoice_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: product_barcodes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."product_barcodes" ("id", "product_id", "barcode", "customer_id", "created_at") VALUES
	('5c429e41-5a81-42fe-97b2-609cada8ed04', '25caef77-40fc-47b2-b925-18ba8c483c5f', '8805854234005', NULL, '2025-08-28 14:17:46.41649+00');


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: sequences; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."stock_movements" ("id", "product_id", "from_warehouse_id", "to_warehouse_id", "quantity_change", "type", "reference_id", "created_at", "is_voided", "notes", "linked_movement_id", "transaction_group_id", "is_historical_import", "reference_type") VALUES
	('770e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000', NULL, -15, 'Transfer Out', NULL, '2025-08-10 10:00:00+00', false, NULL, NULL, '880e8400-e29b-41d4-a716-446655440000', true, NULL),
	('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440000', NULL, '550e8400-e29b-41d4-a716-446655440001', 15, 'Transfer In', NULL, '2025-08-10 10:00:00+00', false, ' [TEST복구:08-22 05:06]', '770e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440000', true, NULL);


--
-- Data for Name: stock_takes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: stock_take_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: temp_invoice_import; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: supabase_functions_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 1, false);


--
-- Name: invoices_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."invoices_number_seq"', 285, false);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: supabase_functions_admin
--

SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

RESET ALL;
