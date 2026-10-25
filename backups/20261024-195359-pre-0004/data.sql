SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict bb52N6cl4VbN1qrSy16kdR7QHu8EyOzjGKIWm2NNTNX73XCV16V3X1V7B2BAOBJ

-- Dumped from database version 17.11
-- Dumped by pg_dump version 18.6

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
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '16a17275-1687-49fa-9453-485a0c6b790f', 'authenticated', 'authenticated', 'flickit.dev@gmail.com', '$2a$10$TAYSLbtPb73zKYPZLEqreOC9DZ1DbFthj20xmMsuNNLttHT8YkpqC', '2026-10-24 16:17:11.209712+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-10-25 00:01:35.036486+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-10-24 16:17:11.201346+00', '2026-10-25 00:01:35.049651+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('16a17275-1687-49fa-9453-485a0c6b790f', '16a17275-1687-49fa-9453-485a0c6b790f', '{"sub": "16a17275-1687-49fa-9453-485a0c6b790f", "email": "flickit.dev@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-10-24 16:17:11.20685+00', '2026-10-24 16:17:11.206913+00', '2026-10-24 16:17:11.206913+00', '223c6109-1bc3-470f-8c81-501afd286d24');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('1f975a0c-9d51-4bd9-91d5-5589c360bb82', '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 23:17:38.204048+00', '2026-10-24 23:17:38.204048+00', NULL, 'aal1', NULL, NULL, 'node', '208.59.148.184', NULL, NULL, NULL, NULL, NULL),
	('2858a07a-86ce-47c5-a98c-25815db71ffe', '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 23:54:19.930511+00', '2026-10-24 23:54:19.930511+00', NULL, 'aal1', NULL, NULL, 'node', '208.59.148.184', NULL, NULL, NULL, NULL, NULL),
	('2a37a6a5-c398-474f-a101-e21396790c08', '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 16:17:19.688251+00', '2026-10-24 23:56:17.29542+00', NULL, 'aal1', NULL, '2026-10-24 23:56:17.295318', 'Next.js Middleware', '208.59.148.184', NULL, NULL, NULL, NULL, NULL),
	('38dcb737-0903-4558-8ccd-09a06107d2e5', '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-25 00:01:35.036593+00', '2026-10-25 00:01:35.036593+00', NULL, 'aal1', NULL, NULL, 'node', '208.59.148.184', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('2a37a6a5-c398-474f-a101-e21396790c08', '2026-10-24 16:17:19.703732+00', '2026-10-24 16:17:19.703732+00', 'password', 'dde8d4ca-6145-46d0-a8bb-42e6dec4e2b4'),
	('1f975a0c-9d51-4bd9-91d5-5589c360bb82', '2026-10-24 23:17:38.239009+00', '2026-10-24 23:17:38.239009+00', 'password', 'a2e64db8-a041-47ba-bb09-1330a196a0d0'),
	('2858a07a-86ce-47c5-a98c-25815db71ffe', '2026-10-24 23:54:19.95478+00', '2026-10-24 23:54:19.95478+00', 'password', '49934b70-ded7-4dc9-ad5e-8acca9d9c0fa'),
	('38dcb737-0903-4558-8ccd-09a06107d2e5', '2026-10-25 00:01:35.051287+00', '2026-10-25 00:01:35.051287+00', 'password', '578302de-be0a-451d-939b-8ccb6c9fb48e');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_recovery_code_sets; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_recovery_codes; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 1, 'zltanmgcbgsx', '16a17275-1687-49fa-9453-485a0c6b790f', true, '2026-10-24 16:17:19.694278+00', '2026-10-24 22:47:45.446924+00', NULL, '2a37a6a5-c398-474f-a101-e21396790c08'),
	('00000000-0000-0000-0000-000000000000', 9, 'caigl2dfvatj', '16a17275-1687-49fa-9453-485a0c6b790f', false, '2026-10-24 23:17:38.218315+00', '2026-10-24 23:17:38.218315+00', NULL, '1f975a0c-9d51-4bd9-91d5-5589c360bb82'),
	('00000000-0000-0000-0000-000000000000', 21, 'ekkrj67l2zxx', '16a17275-1687-49fa-9453-485a0c6b790f', false, '2026-10-24 23:54:19.947585+00', '2026-10-24 23:54:19.947585+00', NULL, '2858a07a-86ce-47c5-a98c-25815db71ffe'),
	('00000000-0000-0000-0000-000000000000', 2, '5dlosoetxh4j', '16a17275-1687-49fa-9453-485a0c6b790f', true, '2026-10-24 22:47:45.467806+00', '2026-10-24 23:56:17.268993+00', 'zltanmgcbgsx', '2a37a6a5-c398-474f-a101-e21396790c08'),
	('00000000-0000-0000-0000-000000000000', 22, 'd4f6ze6x3vwc', '16a17275-1687-49fa-9453-485a0c6b790f', false, '2026-10-24 23:56:17.280444+00', '2026-10-24 23:56:17.280444+00', '5dlosoetxh4j', '2a37a6a5-c398-474f-a101-e21396790c08'),
	('00000000-0000-0000-0000-000000000000', 23, 'nzknlcugfol2', '16a17275-1687-49fa-9453-485a0c6b790f', false, '2026-10-25 00:01:35.045177+00', '2026-10-25 00:01:35.045177+00', NULL, '38dcb737-0903-4558-8ccd-09a06107d2e5');


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
-- Data for Name: scim_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: scim_users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: import_batches; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: spaces; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."spaces" ("id", "name", "type", "currency", "default_split", "inbound_token", "created_by", "created_at", "updated_at", "import_batch_id") VALUES
	('0074650a-dd6a-4d32-b58a-f08c0bbae34b', 'bagley', 'shared_home', 'USD', 'equal', '9fc8c91eb1bd692f81', '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 16:17:42.163669+00', '2026-10-24 16:17:42.163669+00', NULL),
	('3cac49b6-77c8-49b5-b0b3-83b22b7272fa', 'Family Expenses', 'family', 'USD', 'exact', '8dc91fe6bd2899d4de', '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 16:21:07.034116+00', '2026-10-24 16:21:07.034116+00', NULL),
	('d7cf4aaa-f117-4e0a-bcbc-df7999dcb427', 'Lake', 'shared_home', 'USD', 'equal', '597debab423f546411', '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 23:18:00.610546+00', '2026-10-24 23:18:00.610546+00', NULL),
	('8bb59b7d-11d0-4775-8345-83ceef4b0ac8', 'Bagley', 'shared_home', 'USD', 'equal', '473e8197e7b4a40778', '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 23:55:16.474445+00', '2026-10-24 23:55:16.474445+00', NULL);


--
-- Data for Name: activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."activity" ("id", "space_id", "actor_user_id", "entity_type", "entity_id", "action", "metadata", "created_at") OVERRIDING SYSTEM VALUE VALUES
	(1, '0074650a-dd6a-4d32-b58a-f08c0bbae34b', '16a17275-1687-49fa-9453-485a0c6b790f', 'space', '0074650a-dd6a-4d32-b58a-f08c0bbae34b', 'space_created', '{"type": "shared_home"}', '2026-10-24 16:17:42.163669+00'),
	(2, '0074650a-dd6a-4d32-b58a-f08c0bbae34b', '16a17275-1687-49fa-9453-485a0c6b790f', 'invitation', NULL, 'invite_created', '{}', '2026-10-24 16:17:42.774631+00'),
	(3, '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', '16a17275-1687-49fa-9453-485a0c6b790f', 'space', '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', 'space_created', '{"type": "family"}', '2026-10-24 16:21:07.034116+00'),
	(4, '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', '16a17275-1687-49fa-9453-485a0c6b790f', 'invitation', NULL, 'invite_created', '{}', '2026-10-24 16:21:07.520964+00'),
	(23, 'd7cf4aaa-f117-4e0a-bcbc-df7999dcb427', '16a17275-1687-49fa-9453-485a0c6b790f', 'space', 'd7cf4aaa-f117-4e0a-bcbc-df7999dcb427', 'space_created', '{"type": "shared_home"}', '2026-10-24 23:18:00.610546+00'),
	(24, 'd7cf4aaa-f117-4e0a-bcbc-df7999dcb427', '16a17275-1687-49fa-9453-485a0c6b790f', 'invitation', NULL, 'invite_created', '{}', '2026-10-24 23:18:01.41388+00'),
	(56, '8bb59b7d-11d0-4775-8345-83ceef4b0ac8', '16a17275-1687-49fa-9453-485a0c6b790f', 'space', '8bb59b7d-11d0-4775-8345-83ceef4b0ac8', 'space_created', '{"type": "shared_home"}', '2026-10-24 23:55:16.474445+00'),
	(57, '8bb59b7d-11d0-4775-8345-83ceef4b0ac8', '16a17275-1687-49fa-9453-485a0c6b790f', 'invitation', NULL, 'invite_created', '{}', '2026-10-24 23:55:17.002371+00');


--
-- Data for Name: space_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."space_members" ("id", "space_id", "user_id", "role", "status", "joined_at", "left_at", "display_name", "import_batch_id", "claimed_at") VALUES
	('ba1afa51-b624-413f-9604-a9e339bf1be2', '0074650a-dd6a-4d32-b58a-f08c0bbae34b', '16a17275-1687-49fa-9453-485a0c6b790f', 'owner', 'active', '2026-10-24 16:17:42.163669+00', NULL, NULL, NULL, NULL),
	('387602f0-b7d0-4a1d-8c45-795c0fcc7b10', '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', '16a17275-1687-49fa-9453-485a0c6b790f', 'owner', 'active', '2026-10-24 16:21:07.034116+00', NULL, NULL, NULL, NULL),
	('3eba208d-435c-4f2f-ba0b-406668b50740', '8bb59b7d-11d0-4775-8345-83ceef4b0ac8', '16a17275-1687-49fa-9453-485a0c6b790f', 'owner', 'active', '2026-10-24 23:55:16.474445+00', NULL, NULL, NULL, NULL),
	('88607f6e-3b6d-45a1-bcbf-b6bd085561c9', 'd7cf4aaa-f117-4e0a-bcbc-df7999dcb427', '16a17275-1687-49fa-9453-485a0c6b790f', 'owner', 'active', '2026-10-24 23:18:00.610546+00', NULL, NULL, NULL, NULL);


--
-- Data for Name: bills; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: bill_splits; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: claim_preview_attempts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."claim_preview_attempts" ("id", "client_key", "created_at") OVERRIDING SYSTEM VALUE VALUES
	(1, 'c6e677cfe0805b18cf851affa6332f539a40f890f59d8e2b3047dad84c897c75', '2026-10-24 22:58:17.772429+00'),
	(2, 'c6e677cfe0805b18cf851affa6332f539a40f890f59d8e2b3047dad84c897c75', '2026-10-24 22:58:20.427632+00'),
	(3, 'c6e677cfe0805b18cf851affa6332f539a40f890f59d8e2b3047dad84c897c75', '2026-10-24 22:58:23.126078+00'),
	(4, 'c6e677cfe0805b18cf851affa6332f539a40f890f59d8e2b3047dad84c897c75', '2026-10-24 22:59:11.25516+00'),
	(5, 'c6e677cfe0805b18cf851affa6332f539a40f890f59d8e2b3047dad84c897c75', '2026-10-24 22:59:13.802637+00'),
	(6, 'c6e677cfe0805b18cf851affa6332f539a40f890f59d8e2b3047dad84c897c75', '2026-10-24 22:59:17.50827+00'),
	(7, 'c6e677cfe0805b18cf851affa6332f539a40f890f59d8e2b3047dad84c897c75', '2026-10-24 23:00:47.936736+00'),
	(8, 'c6e677cfe0805b18cf851affa6332f539a40f890f59d8e2b3047dad84c897c75', '2026-10-24 23:00:50.514251+00'),
	(9, 'c6e677cfe0805b18cf851affa6332f539a40f890f59d8e2b3047dad84c897c75', '2026-10-24 23:00:53.115038+00');


--
-- Data for Name: extraction_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."extraction_requests" ("id", "user_id", "image_count", "latency_ms", "input_tokens", "output_tokens", "succeeded", "created_at") VALUES
	('5200c452-914b-42f6-a2e3-19060289a2c4', '16a17275-1687-49fa-9453-485a0c6b790f', 2, 19352, 2830, 1829, true, '2026-10-25 00:11:35.748545+00');


--
-- Data for Name: member_claims; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notification_prefs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."notification_prefs" ("user_id", "space_id", "bill_arrival", "reminder_days", "reminders_opt_out") VALUES
	('16a17275-1687-49fa-9453-485a0c6b790f', '0074650a-dd6a-4d32-b58a-f08c0bbae34b', true, '{5,2,1}', false),
	('16a17275-1687-49fa-9453-485a0c6b790f', '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', true, '{5,2,1}', false),
	('16a17275-1687-49fa-9453-485a0c6b790f', 'd7cf4aaa-f117-4e0a-bcbc-df7999dcb427', true, '{5,2,1}', false),
	('16a17275-1687-49fa-9453-485a0c6b790f', '8bb59b7d-11d0-4775-8345-83ceef4b0ac8', true, '{5,2,1}', false);


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "display_name", "created_at") VALUES
	('16a17275-1687-49fa-9453-485a0c6b790f', 'flickit.dev', '2026-10-24 16:17:11.199875+00');


--
-- Data for Name: reminders; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: settlements; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: space_invitations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."space_invitations" ("id", "space_id", "token_hash", "expires_at", "revoked_at", "max_uses", "use_count", "created_by", "created_at") VALUES
	('425b5108-c8c9-49dc-9d0d-37ace2ebf050', '0074650a-dd6a-4d32-b58a-f08c0bbae34b', '008842bb49699264490cd2afb920b89b7c14d87bfc5c87a87a3a9ff0daf9dafe', '2026-10-31 16:17:42.774631+00', NULL, 10, 0, '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 16:17:42.774631+00'),
	('92ad7267-8c84-4a13-96cd-27587a1cbfbc', '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', 'b7051bef228b7e6cd47449107e4ffdc4e1025ed5d727ded2a378f544c49f1883', '2026-10-31 16:21:07.520964+00', NULL, 10, 0, '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 16:21:07.520964+00'),
	('651748f2-1c9d-45ee-94bc-628e40640bbc', 'd7cf4aaa-f117-4e0a-bcbc-df7999dcb427', '4232a0591f2c0b788fbff69c1ee1d5fa8a60142a7aa2aa8cbfca98f27ef8ee34', '2026-10-31 23:18:01.41388+00', NULL, 10, 0, '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 23:18:01.41388+00'),
	('da782f52-36e1-4389-840d-f1292bf5c89c', '8bb59b7d-11d0-4775-8345-83ceef4b0ac8', 'd729cb903e5bedecc5313d43c543c20acfe74a4e042e5884669e80fcfada2cec', '2026-10-31 23:55:17.002371+00', NULL, 10, 0, '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 23:55:17.002371+00');


--
-- Data for Name: statements; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type", "versioning_status", "lifecycle_configuration", "lifecycle_configuration_generation") VALUES
	('statements', 'statements', NULL, '2026-10-24 16:13:10.573894+00', '2026-10-24 16:13:10.573894+00', false, false, 10485760, '{application/pdf}', NULL, 'STANDARD', 'DISABLED', NULL, NULL);


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
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
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 26, true);


--
-- Name: activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."activity_id_seq"', 61, true);


--
-- Name: claim_preview_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."claim_preview_attempts_id_seq"', 9, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict bb52N6cl4VbN1qrSy16kdR7QHu8EyOzjGKIWm2NNTNX73XCV16V3X1V7B2BAOBJ

RESET ALL;
