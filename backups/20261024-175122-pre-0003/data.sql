SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict wGHwSfy8nroHBJT0P90h8dssUeYqL0TtTMH0yXIvjVODWHBfGL4cPX94crKH6Ad

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
	('00000000-0000-0000-0000-000000000000', '16a17275-1687-49fa-9453-485a0c6b790f', 'authenticated', 'authenticated', 'flickit.dev@gmail.com', '$2a$10$TAYSLbtPb73zKYPZLEqreOC9DZ1DbFthj20xmMsuNNLttHT8YkpqC', '2026-10-24 16:17:11.209712+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-10-24 16:17:19.686891+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-10-24 16:17:11.201346+00', '2026-10-24 22:47:45.477384+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


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
	('2a37a6a5-c398-474f-a101-e21396790c08', '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 16:17:19.688251+00', '2026-10-24 22:47:45.504935+00', NULL, 'aal1', NULL, '2026-10-24 22:47:45.504819', 'Next.js Middleware', '208.59.148.184', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('2a37a6a5-c398-474f-a101-e21396790c08', '2026-10-24 16:17:19.703732+00', '2026-10-24 16:17:19.703732+00', 'password', 'dde8d4ca-6145-46d0-a8bb-42e6dec4e2b4');


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
	('00000000-0000-0000-0000-000000000000', 2, '5dlosoetxh4j', '16a17275-1687-49fa-9453-485a0c6b790f', false, '2026-10-24 22:47:45.467806+00', '2026-10-24 22:47:45.467806+00', 'zltanmgcbgsx', '2a37a6a5-c398-474f-a101-e21396790c08');


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
-- Data for Name: spaces; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."spaces" ("id", "name", "type", "currency", "default_split", "inbound_token", "created_by", "created_at", "updated_at") VALUES
	('0074650a-dd6a-4d32-b58a-f08c0bbae34b', 'bagley', 'shared_home', 'USD', 'equal', '9fc8c91eb1bd692f81', '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 16:17:42.163669+00', '2026-10-24 16:17:42.163669+00'),
	('3cac49b6-77c8-49b5-b0b3-83b22b7272fa', 'Family Expenses', 'family', 'USD', 'exact', '8dc91fe6bd2899d4de', '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 16:21:07.034116+00', '2026-10-24 16:21:07.034116+00');


--
-- Data for Name: activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."activity" ("id", "space_id", "actor_user_id", "entity_type", "entity_id", "action", "metadata", "created_at") OVERRIDING SYSTEM VALUE VALUES
	(1, '0074650a-dd6a-4d32-b58a-f08c0bbae34b', '16a17275-1687-49fa-9453-485a0c6b790f', 'space', '0074650a-dd6a-4d32-b58a-f08c0bbae34b', 'space_created', '{"type": "shared_home"}', '2026-10-24 16:17:42.163669+00'),
	(2, '0074650a-dd6a-4d32-b58a-f08c0bbae34b', '16a17275-1687-49fa-9453-485a0c6b790f', 'invitation', NULL, 'invite_created', '{}', '2026-10-24 16:17:42.774631+00'),
	(3, '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', '16a17275-1687-49fa-9453-485a0c6b790f', 'space', '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', 'space_created', '{"type": "family"}', '2026-10-24 16:21:07.034116+00'),
	(4, '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', '16a17275-1687-49fa-9453-485a0c6b790f', 'invitation', NULL, 'invite_created', '{}', '2026-10-24 16:21:07.520964+00');


--
-- Data for Name: space_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."space_members" ("id", "space_id", "user_id", "role", "status", "joined_at", "left_at") VALUES
	('ba1afa51-b624-413f-9604-a9e339bf1be2', '0074650a-dd6a-4d32-b58a-f08c0bbae34b', '16a17275-1687-49fa-9453-485a0c6b790f', 'owner', 'active', '2026-10-24 16:17:42.163669+00', NULL),
	('387602f0-b7d0-4a1d-8c45-795c0fcc7b10', '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', '16a17275-1687-49fa-9453-485a0c6b790f', 'owner', 'active', '2026-10-24 16:21:07.034116+00', NULL);


--
-- Data for Name: bills; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: bill_splits; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notification_prefs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."notification_prefs" ("user_id", "space_id", "bill_arrival", "reminder_days", "reminders_opt_out") VALUES
	('16a17275-1687-49fa-9453-485a0c6b790f', '0074650a-dd6a-4d32-b58a-f08c0bbae34b', true, '{5,2,1}', false),
	('16a17275-1687-49fa-9453-485a0c6b790f', '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', true, '{5,2,1}', false);


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
	('92ad7267-8c84-4a13-96cd-27587a1cbfbc', '3cac49b6-77c8-49b5-b0b3-83b22b7272fa', 'b7051bef228b7e6cd47449107e4ffdc4e1025ed5d727ded2a378f544c49f1883', '2026-10-31 16:21:07.520964+00', NULL, 10, 0, '16a17275-1687-49fa-9453-485a0c6b790f', '2026-10-24 16:21:07.520964+00');


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

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 2, true);


--
-- Name: activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."activity_id_seq"', 4, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict wGHwSfy8nroHBJT0P90h8dssUeYqL0TtTMH0yXIvjVODWHBfGL4cPX94crKH6Ad

RESET ALL;
