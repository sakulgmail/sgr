--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

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
-- Name: CommentType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."CommentType" AS ENUM (
    'requestor_note',
    'manager_decision',
    'staff_ack',
    'staff_finish',
    'handoff',
    'system',
    'status_reset'
);


ALTER TYPE public."CommentType" OWNER TO postgres;

--
-- Name: ProductNodeType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ProductNodeType" AS ENUM (
    'CATEGORY',
    'SUBCATEGORY',
    'PRODUCT'
);


ALTER TYPE public."ProductNodeType" OWNER TO postgres;

--
-- Name: StaffType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StaffType" AS ENUM (
    'PRODUCTION_ENGINEER',
    'PURCHASING',
    'LOGISTICS'
);


ALTER TYPE public."StaffType" OWNER TO postgres;

--
-- Name: TaskState; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TaskState" AS ENUM (
    'active',
    'acknowledged',
    'finished'
);


ALTER TYPE public."TaskState" OWNER TO postgres;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserRole" AS ENUM (
    'REQUESTOR',
    'SALES_MANAGER',
    'STAFF',
    'ADMIN'
);


ALTER TYPE public."UserRole" OWNER TO postgres;

--
-- Name: WorkRequestStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."WorkRequestStatus" AS ENUM (
    'submitted',
    'rejected',
    'approved',
    'preparing_goods_sampling',
    'ready_to_ship',
    'shipped'
);


ALTER TYPE public."WorkRequestStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "actorUserId" text,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    action text NOT NULL,
    before jsonb,
    after jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuditLog" OWNER TO postgres;

--
-- Name: Comment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    "workRequestId" text NOT NULL,
    "authorUserId" text NOT NULL,
    "commentType" public."CommentType" NOT NULL,
    body text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Comment" OWNER TO postgres;

--
-- Name: PasswordResetToken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PasswordResetToken" (
    token text NOT NULL,
    "userId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PasswordResetToken" OWNER TO postgres;

--
-- Name: ProductNode; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ProductNode" (
    id text NOT NULL,
    name text NOT NULL,
    "parentId" text,
    "nodeType" public."ProductNodeType" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProductNode" OWNER TO postgres;

--
-- Name: Setting; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Setting" (
    key text NOT NULL,
    value jsonb NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Setting" OWNER TO postgres;

--
-- Name: Task; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    "workRequestId" text NOT NULL,
    "assigneeUserId" text NOT NULL,
    "taskRole" public."StaffType" NOT NULL,
    state public."TaskState" DEFAULT 'active'::public."TaskState" NOT NULL,
    "acknowledgedAt" timestamp(3) without time zone,
    "finishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Task" OWNER TO postgres;

--
-- Name: TaskHandoff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TaskHandoff" (
    id text NOT NULL,
    "workRequestId" text NOT NULL,
    "fromUserId" text NOT NULL,
    "toUserId" text NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."TaskHandoff" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    "displayName" text NOT NULL,
    phone text,
    role public."UserRole" NOT NULL,
    "staffType" public."StaffType",
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: WorkRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."WorkRequest" (
    id text NOT NULL,
    "workRequestNo" text NOT NULL,
    "requestorUserId" text NOT NULL,
    "productNodeId" text NOT NULL,
    status public."WorkRequestStatus" NOT NULL,
    purpose text NOT NULL,
    "volumeKg" numeric(12,3) NOT NULL,
    "unitCount" integer NOT NULL,
    "receivingAddress" text NOT NULL,
    "receivingPersonFirstname" text NOT NULL,
    "receivingPersonLastname" text NOT NULL,
    "receivingPersonEmail" text NOT NULL,
    "receivingPersonPhone" text NOT NULL,
    "targetReceivingBy" date NOT NULL,
    "dhlTrackingUrl" text,
    "extraFields" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."WorkRequest" OWNER TO postgres;

--
-- Name: WorkRequestAssignment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."WorkRequestAssignment" (
    id text NOT NULL,
    "workRequestId" text NOT NULL,
    "userId" text NOT NULL,
    "assignedBy" text NOT NULL,
    "assignedRole" public."StaffType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."WorkRequestAssignment" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AuditLog" (id, "actorUserId", "entityType", "entityId", action, before, after, "createdAt") FROM stdin;
a9c3a5fa-825c-41d5-878d-c87e192aafe4	93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	work_request	4a335898-a433-42de-899a-3dd7f7f2027c	create_work_request	null	{"status": "submitted", "workRequestNo": "GSR-20260221-0001"}	2026-02-21 02:57:39.219
d588916c-0932-41bb-ba3c-aff08c0f2a32	93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	work_request	5b57e38d-97d0-4dc4-b379-a4fa1234fd59	create_work_request	null	{"status": "submitted", "workRequestNo": "GSR-20260221-0002"}	2026-02-21 02:58:46.398
72500729-242e-45b1-bb49-84ec396b0cff	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	5b57e38d-97d0-4dc4-b379-a4fa1234fd59	approve	{"status": "submitted"}	{"status": "approved", "assignees": ["8d774731-9d7b-40ba-9f48-25289ae4685d", "d6163a39-c1c9-4ca6-82df-bac43818bef8"]}	2026-02-21 03:18:17.167
8fad5604-ccb9-4166-8351-1465864aab1f	8d774731-9d7b-40ba-9f48-25289ae4685d	task	fca02440-d7a5-4ccc-adfb-825331df4585	acknowledge_task	null	{"state": "acknowledged"}	2026-02-21 03:18:20.447
c5194c52-adbc-4edf-a4d8-530c514a6974	8d774731-9d7b-40ba-9f48-25289ae4685d	task	fca02440-d7a5-4ccc-adfb-825331df4585	finish_task	null	{"state": "finished", "handoffToUserIds": ["d6163a39-c1c9-4ca6-82df-bac43818bef8"]}	2026-02-21 03:18:20.467
a462f517-34a9-4fc1-b167-4b46bf6f9473	93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	work_request	ebf5a8a8-c04a-439a-82f3-3d8a4c754674	create_work_request	null	{"status": "submitted", "workRequestNo": "GSR-20260221-0003"}	2026-02-21 03:23:12.004
713b0b51-bbed-4329-b36b-3da231bad53f	93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	work_request	51552974-70a3-4c19-a685-11ae093e9e7e	create_work_request	null	{"status": "submitted", "workRequestNo": "GSR-20260221-0004"}	2026-02-21 03:23:13.212
a7c9734a-8f5c-4ed5-b150-9d894719e60f	93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	work_request	12914e2a-a873-48d1-afc9-0b2e43fe1b28	create_work_request	null	{"status": "submitted", "workRequestNo": "GSR-20260221-0005"}	2026-02-21 03:23:13.771
4610f1ce-7d8a-4825-a815-c68314040239	93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	work_request	d92e110a-a6f2-43b7-8c57-304bc3fe4aae	create_work_request	null	{"status": "submitted", "workRequestNo": "GSR-20260221-0006"}	2026-02-21 03:23:13.949
87f8ef92-0ed7-49a0-a6a0-8d23a0ea84fb	93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	work_request	7ba67fd3-ea06-454e-b24e-60519a940243	create_work_request	null	{"status": "submitted", "workRequestNo": "GSR-20260221-0007"}	2026-02-21 03:23:14.117
6004d47b-ddf9-4b52-9bcc-081ec338b1c7	93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	work_request	5e3e0546-7217-405f-87c2-3b69f3168b5f	create_work_request	null	{"status": "submitted", "workRequestNo": "GSR-20260221-0008"}	2026-02-21 03:23:14.254
18c73d18-3477-4fe9-83c7-7ee5e3291ac0	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	4a335898-a433-42de-899a-3dd7f7f2027c	approve	{"status": "submitted"}	{"status": "approved", "assignees": ["8d774731-9d7b-40ba-9f48-25289ae4685d", "62aa5eeb-e18e-44db-929f-dab13d98d6f5", "d6163a39-c1c9-4ca6-82df-bac43818bef8"]}	2026-02-21 03:25:15.079
79738453-3e6c-4717-b766-91552378947b	8d774731-9d7b-40ba-9f48-25289ae4685d	task	e01964e0-2f07-4502-9178-e7c2dbf2ef2e	acknowledge_task	null	{"state": "acknowledged"}	2026-02-21 03:26:14.791
671c133e-71cf-4258-a33b-18d1dc4a92f0	8d774731-9d7b-40ba-9f48-25289ae4685d	task	e01964e0-2f07-4502-9178-e7c2dbf2ef2e	finish_task	null	{"state": "finished", "handoffToUserIds": ["d6163a39-c1c9-4ca6-82df-bac43818bef8"]}	2026-02-21 04:03:10.039
809f8781-feb3-49cd-99e7-d37ec0944a03	d6163a39-c1c9-4ca6-82df-bac43818bef8	task	becbfe3b-b259-4235-9336-f11b3e231511	acknowledge_task	null	{"state": "acknowledged"}	2026-02-21 04:04:22.969
24a5524e-64df-4a2c-9cc5-44b467cd5a66	93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	work_request	f0f5eae8-c218-41a1-8e9b-7da3c935ea63	create_work_request	null	{"status": "submitted", "workRequestNo": "GSR-20260221-0009"}	2026-02-21 04:17:40.886
84484c99-2288-4ed7-946e-2c10a8c1597c	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	f0f5eae8-c218-41a1-8e9b-7da3c935ea63	approve	{"status": "submitted"}	{"status": "approved", "assignees": ["8d774731-9d7b-40ba-9f48-25289ae4685d", "62aa5eeb-e18e-44db-929f-dab13d98d6f5", "d6163a39-c1c9-4ca6-82df-bac43818bef8"]}	2026-02-21 04:39:08.373
a2062cbe-bd13-4546-85e2-72ce01acd464	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	de7d466a-bd06-4490-b447-21dcc073eb14	create_catalog_node	\N	{"name": "Acid donor, alkaline donor and buffer", "nodeType": "CATEGORY", "parentId": null}	2026-02-21 07:17:22.254
57e4cffd-d42c-4aeb-b6b8-e8b154e5f0e0	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	8501a6da-f4af-49fb-9fb4-3fce69feee0d	create_catalog_node	\N	{"name": "CEL", "nodeType": "SUBCATEGORY", "parentId": "de7d466a-bd06-4490-b447-21dcc073eb14"}	2026-02-21 07:18:01.255
b858aec5-df9b-4f36-b265-2a6a1463eb35	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	537b0f33-9fc9-4876-8aaa-bf1d947711d0	create_catalog_node	\N	{"name": "TANACID NA 01", "nodeType": "PRODUCT", "parentId": "8501a6da-f4af-49fb-9fb4-3fce69feee0d"}	2026-02-21 07:18:53.736
40a06e46-2413-4793-a32d-44d6c40b792f	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9	create_user	\N	{"id": "9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9", "role": "REQUESTOR", "email": "tempuser@gsr.local", "isActive": true, "staffType": null, "displayName": "Temp User"}	2026-02-21 07:31:44.055
e6d78780-894c-4186-ad63-2b2649dd1c05	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9	update_user	{"role": "REQUESTOR", "isActive": true, "staffType": null, "displayName": "Temp User"}	{"id": "9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9", "role": "REQUESTOR", "email": "tempuser@gsr.local", "isActive": false, "staffType": null, "displayName": "Temp User"}	2026-02-21 07:31:44.07
e6b81730-d6fd-4d25-b692-9adc38920bcf	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	settings	system	update_settings	\N	["app_base_url", "manufacturing_group_email"]	2026-02-21 07:36:21.149
2da18068-63aa-4eb5-b700-6c437ca56f04	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	de7d466a-bd06-4490-b447-21dcc073eb14	update_catalog_node	{"name": "Acid donor, alkaline donor and buffer", "isActive": true, "parentId": null, "sortOrder": 0}	{"name": "Acid donor, alkaline donor and buffer", "isActive": true, "parentId": null, "sortOrder": 0}	2026-02-21 07:36:21.169
f844fb29-b2d8-442f-a9a0-2a57166a3810	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9	update_user	{"role": "REQUESTOR", "isActive": false, "staffType": null, "displayName": "Temp User"}	{"id": "9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9", "role": "REQUESTOR", "email": "tempuser@gsr.local", "isActive": false, "staffType": null, "displayName": "Temp User"}	2026-02-21 08:53:35.574
ee4f2608-a107-4c1a-b7bb-9e4a94940672	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9	update_user	{"role": "REQUESTOR", "isActive": false, "staffType": null, "displayName": "Temp User"}	{"id": "9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9", "role": "REQUESTOR", "email": "tempuser@gsr.local", "isActive": false, "staffType": null, "displayName": "Temp User"}	2026-02-21 08:53:37.968
934533c1-d0c1-4cba-9839-6819e63ea735	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9	update_user	{"role": "REQUESTOR", "isActive": false, "staffType": null, "displayName": "Temp User"}	{"id": "9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9", "role": "SALES_MANAGER", "email": "tempuser@gsr.local", "isActive": false, "staffType": null, "displayName": "Temp User"}	2026-02-21 08:53:40.155
0e168afb-dd9a-4ae4-95aa-89f7f6e5738e	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9	update_user	{"role": "SALES_MANAGER", "isActive": false, "staffType": null, "displayName": "Temp User"}	{"id": "9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9", "role": "REQUESTOR", "email": "tempuser@gsr.local", "isActive": false, "staffType": null, "displayName": "Temp User"}	2026-02-21 08:53:42.129
a28a8183-28a8-4f7a-80f7-1c0c8c33f08c	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	10e069b1-b444-49bf-97c2-4fa61115fff0	create_user	\N	{"id": "10e069b1-b444-49bf-97c2-4fa61115fff0", "role": "STAFF", "email": "peerapol@itpattana.com", "isActive": true, "staffType": "PRODUCTION_ENGINEER", "displayName": "Peerapol"}	2026-02-24 08:49:11.427
78999ca9-df4d-40c3-9913-6f4c431ffd5a	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	4541befe-415d-485d-b400-a2e9b381275f	create_catalog_node	\N	{"name": "Acid donor, alkaline donor and buffer", "nodeType": "CATEGORY", "parentId": null}	2026-02-24 08:49:53.443
22c39c27-86f0-49d6-ba18-33abc9980daf	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9	update_user	{"role": "REQUESTOR", "isActive": false, "staffType": null, "displayName": "Temp User"}	{"id": "9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9", "role": "REQUESTOR", "email": "tempuser@gsr.local", "isActive": false, "staffType": null, "displayName": "Temp User"}	2026-03-06 14:08:49.599
b357c883-566d-4ad1-bcfa-12535f7fc666	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	537b0f33-9fc9-4876-8aaa-bf1d947711d0	update_catalog_node	{"name": "TANACID NA 01", "isActive": true, "parentId": "8501a6da-f4af-49fb-9fb4-3fce69feee0d", "sortOrder": 0}	{"name": "TANACID NA 01", "isActive": false, "parentId": "8501a6da-f4af-49fb-9fb4-3fce69feee0d", "sortOrder": 0}	2026-03-06 14:21:40.688
7ffe15b3-421b-4aa4-925c-66388d0c0f21	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	00000000-0000-0000-0000-000000000103	update_catalog_node	{"name": "Orange Syrup Base", "isActive": true, "parentId": "00000000-0000-0000-0000-000000000102", "sortOrder": 1}	{"name": "Orange Syrup Base", "isActive": false, "parentId": "00000000-0000-0000-0000-000000000102", "sortOrder": 1}	2026-03-06 14:21:44.634
a734f355-a4c8-4017-a96b-4fffcacd23b3	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	00000000-0000-0000-0000-000000000103	update_catalog_node	{"name": "Orange Syrup Base", "isActive": false, "parentId": "00000000-0000-0000-0000-000000000102", "sortOrder": 1}	{"name": "Orange Syrup Base", "isActive": false, "parentId": "00000000-0000-0000-0000-000000000102", "sortOrder": 1}	2026-03-06 14:21:45.5
64bad102-c8bc-44a2-9296-50155aa18778	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	537b0f33-9fc9-4876-8aaa-bf1d947711d0	update_catalog_node	{"name": "TANACID NA 01", "isActive": false, "parentId": "8501a6da-f4af-49fb-9fb4-3fce69feee0d", "sortOrder": 0}	{"name": "TANACID NA 01", "isActive": false, "parentId": "8501a6da-f4af-49fb-9fb4-3fce69feee0d", "sortOrder": 0}	2026-03-06 14:21:47.574
03c99248-da91-44fd-9013-03ebabc7a4ac	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9	update_user	{"role": "REQUESTOR", "isActive": false, "staffType": null, "displayName": "Temp User"}	{"id": "9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9", "role": "REQUESTOR", "email": "tempuser@gsr.local", "isActive": true, "staffType": null, "displayName": "Temp User"}	2026-03-06 14:26:32.576
c3898a78-ab6b-4bf3-bb47-416a4b52ab98	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9	delete_user	{"id": "9a80a731-fd80-4bd8-b4b0-31a5a86c1ff9", "role": "REQUESTOR", "email": "tempuser@gsr.local", "isActive": true, "staffType": null, "displayName": "Temp User"}	\N	2026-03-06 14:26:46.199
4499b9c6-9a49-47bc-8b84-824659741ff7	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	19732409-1a47-4401-802b-a34de920a5c4	create_user	\N	{"id": "19732409-1a47-4401-802b-a34de920a5c4", "role": "REQUESTOR", "email": "test2@gsr.local", "isActive": true, "staffType": null, "displayName": "Test2"}	2026-03-06 14:27:40.278
4e978620-42bb-44a2-9a77-a611786314a2	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	c7a85b08-1f54-4c1e-b0a7-711554b7aadd	create_user	\N	{"id": "c7a85b08-1f54-4c1e-b0a7-711554b7aadd", "role": "STAFF", "email": "test3@gsr.local", "isActive": true, "staffType": "PRODUCTION_ENGINEER", "displayName": "Test3"}	2026-03-06 14:31:08.942
ce46b972-a1b6-48a1-bab9-723aba3573ec	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	69808bdf-b79c-4d58-9942-da911c95f483	create_user	\N	{"id": "69808bdf-b79c-4d58-9942-da911c95f483", "role": "REQUESTOR", "email": "test5@gsr.local", "isActive": true, "staffType": null, "displayName": "Test5"}	2026-03-06 14:35:54.425
772d657e-ea32-4a35-addf-673c65450b21	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	69808bdf-b79c-4d58-9942-da911c95f483	delete_user	{"id": "69808bdf-b79c-4d58-9942-da911c95f483", "role": "REQUESTOR", "email": "test5@gsr.local", "isActive": true, "staffType": null, "displayName": "Test5"}	\N	2026-03-06 14:36:19.418
db7beddd-bba0-414d-97db-bb008ccca2c9	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	c7a85b08-1f54-4c1e-b0a7-711554b7aadd	update_user	{"role": "STAFF", "isActive": true, "staffType": "PRODUCTION_ENGINEER", "displayName": "Test3"}	{"id": "c7a85b08-1f54-4c1e-b0a7-711554b7aadd", "role": "STAFF", "email": "test3@gsr.local", "isActive": false, "staffType": "PRODUCTION_ENGINEER", "displayName": "Test3"}	2026-03-06 14:44:44.133
4a659b3c-23bc-4b66-aa09-3ef6e7d63286	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	c7a85b08-1f54-4c1e-b0a7-711554b7aadd	delete_user	{"id": "c7a85b08-1f54-4c1e-b0a7-711554b7aadd", "role": "STAFF", "email": "test3@gsr.local", "isActive": false, "staffType": "PRODUCTION_ENGINEER", "displayName": "Test3"}	\N	2026-03-06 14:47:24.04
267e9014-0248-4d77-b8fa-710a1d3ac8cb	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	19732409-1a47-4401-802b-a34de920a5c4	update_user	{"role": "REQUESTOR", "isActive": true, "staffType": null, "displayName": "Test2"}	{"id": "19732409-1a47-4401-802b-a34de920a5c4", "role": "REQUESTOR", "email": "test2@gsr.local", "isActive": false, "staffType": null, "displayName": "Test2"}	2026-03-07 09:39:13.607
5abeb9bc-0943-4556-9802-fb385d3b9c99	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	537b0f33-9fc9-4876-8aaa-bf1d947711d0	delete_catalog_node	{"id": "537b0f33-9fc9-4876-8aaa-bf1d947711d0", "name": "TANACID NA 01", "isActive": false, "nodeType": "PRODUCT", "parentId": "8501a6da-f4af-49fb-9fb4-3fce69feee0d", "sortOrder": 0}	\N	2026-03-07 11:22:25.475
cbb3a42f-ec81-40e9-a3ca-eb33081d5bd5	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	00000000-0000-0000-0000-000000000103	update_catalog_node	{"name": "Orange Syrup Base", "isActive": false, "parentId": "00000000-0000-0000-0000-000000000102", "sortOrder": 1}	{"name": "Orange Syrup Base", "isActive": true, "parentId": "00000000-0000-0000-0000-000000000102", "sortOrder": 1}	2026-03-07 11:22:53.687
6239e1bf-8026-4f16-8ae5-59880173d934	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	user	a7cc7905-2af1-4545-b695-5ae3837372af	update_user	{"role": "SALES_MANAGER", "isActive": true, "staffType": null, "displayName": "Sales Manager"}	{"id": "a7cc7905-2af1-4545-b695-5ae3837372af", "role": "SALES_MANAGER", "email": "manager@gsr.local", "isActive": true, "staffType": null, "displayName": "Sales Manager"}	2026-03-07 11:30:19.233
92399761-ec27-4edc-8599-a2bc8f9f1fc2	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	5e3e0546-7217-405f-87c2-3b69f3168b5f	delete_work_request	{"status": "submitted", "workRequestNo": "GSR-20260221-0008"}	null	2026-03-07 11:37:28.792
6873ce42-0002-4ff9-b51e-352fbad128a3	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	7ba67fd3-ea06-454e-b24e-60519a940243	delete_work_request	{"status": "submitted", "workRequestNo": "GSR-20260221-0007"}	null	2026-03-07 11:37:31.501
beb4cf71-2275-4d53-a7f7-06b600826be1	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	d92e110a-a6f2-43b7-8c57-304bc3fe4aae	delete_work_request	{"status": "submitted", "workRequestNo": "GSR-20260221-0006"}	null	2026-03-07 11:37:34.181
9fc1c034-d640-4ca1-95a5-22b6e8f604be	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	12914e2a-a873-48d1-afc9-0b2e43fe1b28	delete_work_request	{"status": "submitted", "workRequestNo": "GSR-20260221-0005"}	null	2026-03-07 11:37:38.654
8625080d-f781-46ee-b786-d4e66a2d2946	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	51552974-70a3-4c19-a685-11ae093e9e7e	delete_work_request	{"status": "submitted", "workRequestNo": "GSR-20260221-0004"}	null	2026-03-07 11:37:49.71
e7514ede-3eec-4e9b-9b3b-159a6e1d8378	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	f0f5eae8-c218-41a1-8e9b-7da3c935ea63	delete_work_request	{"status": "approved", "workRequestNo": "GSR-20260221-0009"}	null	2026-03-07 11:45:03.545
6cbf3380-a642-4d1c-ba1c-0f947d4883b7	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	ebf5a8a8-c04a-439a-82f3-3d8a4c754674	delete_work_request	{"status": "submitted", "workRequestNo": "GSR-20260221-0003"}	null	2026-03-07 11:45:11.566
e7127465-922e-482c-94e3-26b8cf4432ca	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	5b57e38d-97d0-4dc4-b379-a4fa1234fd59	delete_work_request	{"status": "approved", "workRequestNo": "GSR-20260221-0002"}	null	2026-03-07 11:45:18.581
2529dfbc-592f-40f9-86a9-9097891cdb5a	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	4a335898-a433-42de-899a-3dd7f7f2027c	delete_work_request	{"status": "approved", "workRequestNo": "GSR-20260221-0001"}	null	2026-03-07 11:46:21.097
006a43c7-367f-46fd-8a32-59f158e2d126	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	00000000-0000-0000-0000-000000000103	delete_catalog_node	{"id": "00000000-0000-0000-0000-000000000103", "name": "Orange Syrup Base", "isActive": true, "nodeType": "PRODUCT", "parentId": "00000000-0000-0000-0000-000000000102", "sortOrder": 1}	\N	2026-03-07 12:02:40.77
163cbcac-44bc-423c-916d-991391bced26	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	00000000-0000-0000-0000-000000000102	delete_catalog_node	{"id": "00000000-0000-0000-0000-000000000102", "name": "Sweeteners", "isActive": true, "nodeType": "SUBCATEGORY", "parentId": "00000000-0000-0000-0000-000000000101", "sortOrder": 1}	\N	2026-03-07 12:04:07.307
c88e9a7c-1352-4927-9592-ac7b1d8c0fae	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	8501a6da-f4af-49fb-9fb4-3fce69feee0d	delete_catalog_node	{"id": "8501a6da-f4af-49fb-9fb4-3fce69feee0d", "name": "CEL", "isActive": true, "nodeType": "SUBCATEGORY", "parentId": "de7d466a-bd06-4490-b447-21dcc073eb14", "sortOrder": 0}	\N	2026-03-07 12:04:11.386
a6ea921f-acce-44f3-9998-2c4ffce3f761	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	de7d466a-bd06-4490-b447-21dcc073eb14	delete_catalog_node	{"id": "de7d466a-bd06-4490-b447-21dcc073eb14", "name": "Acid donor, alkaline donor and buffer", "isActive": true, "nodeType": "CATEGORY", "parentId": null, "sortOrder": 0}	\N	2026-03-07 12:04:18.715
523e38f5-5b10-461e-b208-cabb00e94586	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	00000000-0000-0000-0000-000000000101	delete_catalog_node	{"id": "00000000-0000-0000-0000-000000000101", "name": "Food Ingredients", "isActive": true, "nodeType": "CATEGORY", "parentId": null, "sortOrder": 1}	\N	2026-03-07 12:04:22.236
466f50d5-1297-4f4a-8219-3156c4f20bda	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	4541befe-415d-485d-b400-a2e9b381275f	update_catalog_node	{"name": "Acid donor, alkaline donor and buffer [archived-4541befe]", "isActive": false, "parentId": null, "sortOrder": 0}	{"name": "Acid donor, alkaline donor and buffer [archived-4541befe]", "isActive": true, "parentId": null, "sortOrder": 0}	2026-03-07 12:04:46.436
6e48b5a7-4d94-46ab-b3aa-4c6b8a6954ee	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	4541befe-415d-485d-b400-a2e9b381275f	update_catalog_node	{"name": "Acid donor, alkaline donor and buffer [archived-4541befe]", "isActive": true, "parentId": null, "sortOrder": 0}	{"name": "Acid donor, alkaline donor and buffer [archived-4541befe]", "isActive": true, "parentId": null, "sortOrder": 0}	2026-03-07 12:04:48.77
61f81fb0-341a-4436-b5fa-6abea3140024	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	4541befe-415d-485d-b400-a2e9b381275f	delete_catalog_node	{"id": "4541befe-415d-485d-b400-a2e9b381275f", "name": "Acid donor, alkaline donor and buffer [archived-4541befe]", "isActive": true, "nodeType": "CATEGORY", "parentId": null, "sortOrder": 0}	\N	2026-03-07 12:04:56.144
238d7a21-3260-49d6-87c6-e72ce7f8ace7	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	b574a09f-4c6a-4eae-803c-d37518a02364	create_catalog_node	\N	{"name": "Acid donor, alkaline donor and buffer", "nodeType": "CATEGORY", "parentId": null}	2026-03-07 12:24:01.544
44c6d4bc-6399-4b72-9fbe-e850334bf405	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	3785c887-4234-4689-ae32-d0face334e92	create_catalog_node	\N	{"name": "Anti-frosting agent", "nodeType": "CATEGORY", "parentId": null}	2026-03-07 12:24:45.637
66ddcbe1-eb63-4961-b4c3-15a591f48932	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	b759d5d5-f1cd-4e02-914a-4a177c763f5c	create_catalog_node	\N	{"name": "Anti-migration agent", "nodeType": "CATEGORY", "parentId": null}	2026-03-07 12:28:12.757
51efe60a-5783-436f-8142-5418b470850c	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	bc99c666-21fe-4822-bd84-77dd55f61e5f	create_catalog_node	\N	{"name": "Deaerator / defoamer", "nodeType": "CATEGORY", "parentId": null}	2026-03-07 12:32:05.379
acc01c6b-9c29-42c7-a44d-6b30c065e83d	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	06c51b5f-8cdd-4e6a-9675-baec81b84e41	create_catalog_node	\N	{"name": "Diffusion accelerator / carrier", "nodeType": "CATEGORY", "parentId": null}	2026-03-07 12:32:58.813
142a8a9e-80eb-4fe4-b674-09930ba2ce5f	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	42cab79c-324e-4a24-b0b7-5821ecd1c9c6	create_catalog_node	\N	{"name": "CEL", "nodeType": "SUBCATEGORY", "parentId": "b574a09f-4c6a-4eae-803c-d37518a02364"}	2026-03-07 12:33:58.103
31c7f77a-6c80-4910-95ad-d6e6517deaef	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	17db6fa0-bfec-4b5b-848d-46c01f30f521	create_catalog_node	\N	{"name": "PA/WO/SE", "nodeType": "SUBCATEGORY", "parentId": "b574a09f-4c6a-4eae-803c-d37518a02364"}	2026-03-07 12:38:40.161
f9d3beb7-839e-44fd-a653-d30b471ce55e	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	f6709a1b-e692-491b-a9a7-c158a0e62790	create_catalog_node	\N	{"name": "PES", "nodeType": "SUBCATEGORY", "parentId": "b574a09f-4c6a-4eae-803c-d37518a02364"}	2026-03-07 12:40:00.974
e88c940a-43bf-4928-90d3-47b182287a5d	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	3c0be1d7-357c-4d38-a3c7-29decb963394	create_catalog_node	\N	{"name": "CEL", "nodeType": "SUBCATEGORY", "parentId": "b759d5d5-f1cd-4e02-914a-4a177c763f5c"}	2026-03-07 12:43:03.046
61260f00-5324-439f-a08f-f9bb2f00209d	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	499a38e0-f15a-4807-9a66-a8f22f9362f0	create_catalog_node	\N	{"name": "PES", "nodeType": "SUBCATEGORY", "parentId": "b759d5d5-f1cd-4e02-914a-4a177c763f5c"}	2026-03-07 12:43:25.919
9989751b-d35c-43ad-b4d9-53d6f4ed3d22	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	262d8f20-0e75-4fac-a3b4-cb2e15d53dc8	create_catalog_node	\N	{"name": "Aramid", "nodeType": "SUBCATEGORY", "parentId": "06c51b5f-8cdd-4e6a-9675-baec81b84e41"}	2026-03-07 12:44:04.88
8f84677c-6f34-4180-8047-474f1c355f06	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	dc1b8af9-326b-4b69-8283-a4c01db7d50e	create_catalog_node	\N	{"name": "PAN", "nodeType": "SUBCATEGORY", "parentId": "06c51b5f-8cdd-4e6a-9675-baec81b84e41"}	2026-03-07 12:44:19.443
ec5d6733-8613-4bd5-ac5e-16a9368cea05	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	509f0e0f-48c0-4cc5-bd45-e9ac44de6599	create_catalog_node	\N	{"name": "PES", "nodeType": "SUBCATEGORY", "parentId": "06c51b5f-8cdd-4e6a-9675-baec81b84e41"}	2026-03-07 12:44:33.551
a40cdcbd-ce41-4c73-aad9-df088429a437	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	7ab57be3-6c84-4de0-9a58-0818f3429472	create_catalog_node	\N	{"name": "TANACID AB 02", "nodeType": "PRODUCT", "parentId": "42cab79c-324e-4a24-b0b7-5821ecd1c9c6"}	2026-03-07 12:45:39.633
8bf357cc-730e-480c-becf-ef22468c018e	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	52d4588b-affc-4c07-b81b-13f8d5597f21	create_catalog_node	\N	{"name": "TANACID AGP", "nodeType": "PRODUCT", "parentId": "42cab79c-324e-4a24-b0b7-5821ecd1c9c6"}	2026-03-07 12:47:46.79
b8e0b9c7-fe6f-402f-82ec-9abf9845c9f0	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	e14da699-ae7e-4149-b4d4-eb1532617280	create_catalog_node	\N	{"name": "TANACID ARB", "nodeType": "PRODUCT", "parentId": "42cab79c-324e-4a24-b0b7-5821ecd1c9c6"}	2026-03-07 12:48:08.397
9e3e08b2-2381-42e5-a1f6-fd75ee307af8	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	2e1aa5bd-5100-4d3c-bc3f-e8b1e397c938	create_catalog_node	\N	{"name": "TANACID NA 01", "nodeType": "PRODUCT", "parentId": "42cab79c-324e-4a24-b0b7-5821ecd1c9c6"}	2026-03-07 12:48:30.733
49ff2e03-10e4-4ed9-97d6-6b2aa519c8d8	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	a4158a68-0e5b-4a0f-a869-373fd3cbe516	create_catalog_node	\N	{"name": "TANACID NAC", "nodeType": "PRODUCT", "parentId": "42cab79c-324e-4a24-b0b7-5821ecd1c9c6"}	2026-03-07 12:48:51.957
7d25ec55-d1d7-42d5-afd1-522e70f4bd15	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	2c1096b9-b17b-48a8-b46c-d92557bb6fb8	create_catalog_node	\N	{"name": "TANACID SAB", "nodeType": "PRODUCT", "parentId": "42cab79c-324e-4a24-b0b7-5821ecd1c9c6"}	2026-03-07 12:49:03.276
9cd27fc4-3685-4a81-9baa-7f207e3064eb	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	e5e2369c-a93e-4b71-9491-bb13190d016a	create_catalog_node	\N	{"name": "TANACID UNA", "nodeType": "PRODUCT", "parentId": "42cab79c-324e-4a24-b0b7-5821ecd1c9c6"}	2026-03-07 12:49:14.778
046a2f79-703b-4acd-b6be-796d47c3074d	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	ff7245eb-c882-4bf5-8171-210d08e73dcb	create_catalog_node	\N	{"name": "TANACID AGP", "nodeType": "PRODUCT", "parentId": "17db6fa0-bfec-4b5b-848d-46c01f30f521"}	2026-03-07 12:49:38.337
28f5a1d5-cf93-4fd3-93c6-0a8abdebb5e4	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	07cf5cd9-d620-487f-9855-330ee60a5db9	create_catalog_node	\N	{"name": "TANACID NAC", "nodeType": "PRODUCT", "parentId": "17db6fa0-bfec-4b5b-848d-46c01f30f521"}	2026-03-07 12:49:57.269
960a5cc7-b6c0-4e00-942b-12f3441bcd7c	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	0334a76e-4fa6-4ed9-9572-e03a4471b91a	create_catalog_node	\N	{"name": "TANACID SAB", "nodeType": "PRODUCT", "parentId": "17db6fa0-bfec-4b5b-848d-46c01f30f521"}	2026-03-07 12:50:14.643
349df607-6d9d-4d36-aa2a-8aada3957c43	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	02b3eaad-f6de-4100-a7b8-20345f92bd22	create_catalog_node	\N	{"name": "TANACID UNA", "nodeType": "PRODUCT", "parentId": "17db6fa0-bfec-4b5b-848d-46c01f30f521"}	2026-03-07 12:50:26.938
1cdb1ed2-92b6-43c9-a37c-dd511082a206	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	984931bf-326a-460b-bba2-79958d5d50cb	create_catalog_node	\N	{"name": "TANACID AB 02", "nodeType": "PRODUCT", "parentId": "f6709a1b-e692-491b-a9a7-c158a0e62790"}	2026-03-07 12:50:57.75
7be06180-acdc-4b98-a67a-992dff8e773f	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	6e58f3fe-5d9d-4dae-bb55-a25976c8dd33	create_catalog_node	\N	{"name": "TANACID ARB", "nodeType": "PRODUCT", "parentId": "f6709a1b-e692-491b-a9a7-c158a0e62790"}	2026-03-07 12:51:14.365
72fc4824-6042-41a6-9cca-8523275ccec1	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	db7ff0a0-4449-4076-84d7-26eda051067a	create_catalog_node	\N	{"name": "TANACID SAB", "nodeType": "PRODUCT", "parentId": "f6709a1b-e692-491b-a9a7-c158a0e62790"}	2026-03-07 12:51:28.078
d3b5984c-509e-42db-80ce-544931355e35	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	a84affbf-0b00-40fd-bc65-c70b9abab0e4	create_catalog_node	\N	{"name": "TANALEV AFP", "nodeType": "PRODUCT", "parentId": "3785c887-4234-4689-ae32-d0face334e92"}	2026-03-07 12:52:00.067
f38ac0f8-9051-4757-969a-a36a206fad52	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	509f0e0f-48c0-4cc5-bd45-e9ac44de6599	delete_catalog_node	{"id": "509f0e0f-48c0-4cc5-bd45-e9ac44de6599", "name": "PES", "isActive": true, "nodeType": "SUBCATEGORY", "parentId": "06c51b5f-8cdd-4e6a-9675-baec81b84e41", "sortOrder": 0}	\N	2026-03-07 13:24:30.503
a1282a1b-9c36-434a-8821-7bc956c7c33f	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	fca9ac40-edcf-4df7-b022-c84ed0a151a3	create_catalog_node	\N	{"name": "PES", "nodeType": "SUBCATEGORY", "parentId": "06c51b5f-8cdd-4e6a-9675-baec81b84e41"}	2026-03-07 13:25:00.278
1d956207-821c-4f2d-9b05-e8a50ab15a4d	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	935d9cb3-5b69-48c1-b334-3603702429e6	create_catalog_node	\N	{"name": "TANADE MIP 01", "nodeType": "PRODUCT", "parentId": "3c0be1d7-357c-4d38-a3c7-29decb963394"}	2026-03-07 13:26:45.993
bd4a0b29-4fc6-493c-94eb-566a57838b66	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	f0dedce0-aa7d-4a64-9854-4f1a7bf66c98	create_catalog_node	\N	{"name": "TANADE MIP 01", "nodeType": "PRODUCT", "parentId": "499a38e0-f15a-4807-9a66-a8f22f9362f0"}	2026-03-07 13:27:17.317
80eae712-4610-4a37-8e8d-8155604cc7bb	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	52fb8a5c-d910-4be1-904d-44ba11204dd4	create_catalog_node	\N	{"name": "NOFOAM AF", "nodeType": "PRODUCT", "parentId": "bc99c666-21fe-4822-bd84-77dd55f61e5f"}	2026-03-07 13:27:54.293
3554beee-57c7-4faa-ba8e-eb72c772e894	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	8053e4ce-9127-471a-a618-46d3f643582d	create_catalog_node	\N	{"name": "NOFOAM DS", "nodeType": "PRODUCT", "parentId": "bc99c666-21fe-4822-bd84-77dd55f61e5f"}	2026-03-07 13:28:05.837
9dc0b721-7442-40ba-bdc7-16422eb534c8	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	aac3a6ba-9f7c-493e-b90b-fe5938e8dd60	create_catalog_node	\N	{"name": "NOFOAM HT", "nodeType": "PRODUCT", "parentId": "bc99c666-21fe-4822-bd84-77dd55f61e5f"}	2026-03-07 13:28:16.045
f0a6c78b-1bfb-40ad-84fb-3dc345603e1e	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	8cb883eb-19c7-4062-9582-d42ca66b2b0d	create_catalog_node	\N	{"name": "RESPUMIT BA 2000", "nodeType": "PRODUCT", "parentId": "bc99c666-21fe-4822-bd84-77dd55f61e5f"}	2026-03-07 13:28:57.144
de5def12-3f2a-4c8f-8d4c-af6c892f8d45	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	4f8f6670-9da5-4de3-9034-b5b546bd391b	create_catalog_node	\N	{"name": "RESPUMIT NF 01", "nodeType": "PRODUCT", "parentId": "bc99c666-21fe-4822-bd84-77dd55f61e5f"}	2026-03-07 13:29:23.097
eaa58681-0108-466d-8bd1-9185c01b9598	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	19a264a5-ecc3-4413-bc04-15f29c8b4838	create_catalog_node	\N	{"name": "RESPUMIT S", "nodeType": "PRODUCT", "parentId": "bc99c666-21fe-4822-bd84-77dd55f61e5f"}	2026-03-07 13:29:32.666
7837ed3f-6a0d-4341-b541-227e7262fe35	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	05bd94e1-8edb-450a-b79a-4b4a8ace0e76	create_catalog_node	\N	{"name": "LEVELGAL C 55", "nodeType": "PRODUCT", "parentId": "262d8f20-0e75-4fac-a3b4-cb2e15d53dc8"}	2026-03-07 13:30:00.564
9bf189f0-78fc-433e-bbc6-159febb6458d	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	6af96576-26c8-42ac-8adf-fecf3ee5a0cf	create_catalog_node	\N	{"name": "TANASSIST ACE-N", "nodeType": "PRODUCT", "parentId": "dc1b8af9-326b-4b69-8283-a4c01db7d50e"}	2026-03-07 13:30:32.04
a3796a70-4a5a-4c08-a7fb-b052f5b9b44c	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	801cff77-3e04-46f2-9970-d2059494f3ef	create_catalog_node	\N	{"name": "TANAVOL AS 01", "nodeType": "PRODUCT", "parentId": "fca9ac40-edcf-4df7-b022-c84ed0a151a3"}	2026-03-07 13:31:02.179
75b1e230-65b9-4cda-8c3b-a1f2d885cbf9	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	5b8214fa-5490-4714-ae46-eccf704091d9	create_catalog_node	\N	{"name": "TANAVOL DAP", "nodeType": "PRODUCT", "parentId": "fca9ac40-edcf-4df7-b022-c84ed0a151a3"}	2026-03-07 13:31:14.882
495f3fd5-2f39-453d-b431-a66079288e28	fcda1502-f429-4ae8-baeb-7ae4e2d9a358	product_node	7ff66df1-8ac5-4560-9acf-8491cd5a56dc	create_catalog_node	\N	{"name": "TANAVOL PEP 01", "nodeType": "PRODUCT", "parentId": "fca9ac40-edcf-4df7-b022-c84ed0a151a3"}	2026-03-07 13:31:26.583
318f79ba-82d5-4fda-b305-1f2da5fcf8aa	93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	work_request	22c71287-de37-4437-b454-d65194d25768	create_work_request	null	{"status": "submitted", "workRequestNo": "GSR-20260308-0001"}	2026-03-08 02:41:40.172
f6c0a552-8478-4c40-977b-c7bcdf5850a7	a7cc7905-2af1-4545-b695-5ae3837372af	work_request	22c71287-de37-4437-b454-d65194d25768	approve	{"status": "submitted"}	{"status": "approved", "assignees": ["8d774731-9d7b-40ba-9f48-25289ae4685d", "62aa5eeb-e18e-44db-929f-dab13d98d6f5", "d6163a39-c1c9-4ca6-82df-bac43818bef8"]}	2026-03-08 08:19:08.578
f8d339dd-e3f3-4418-8e0e-c64fe2af500c	8d774731-9d7b-40ba-9f48-25289ae4685d	task	8f373382-6f7b-434b-8d99-19ce4fcad621	acknowledge_task	null	{"state": "acknowledged"}	2026-03-08 09:18:05.585
78114659-7b9f-4e97-b2d1-339fdf9e9cd7	62aa5eeb-e18e-44db-929f-dab13d98d6f5	task	29d12178-0ebd-42f9-b65e-3337ff26ca93	acknowledge_task	null	{"state": "acknowledged"}	2026-03-08 09:19:45.868
e0d78ce6-3d72-45a2-9164-e3f3dab859c8	62aa5eeb-e18e-44db-929f-dab13d98d6f5	task	29d12178-0ebd-42f9-b65e-3337ff26ca93	finish_task	null	{"state": "finished", "handoffToUserIds": []}	2026-03-08 09:23:41.437
051344bd-38c9-454a-b618-fb06f584aa50	8d774731-9d7b-40ba-9f48-25289ae4685d	task	8f373382-6f7b-434b-8d99-19ce4fcad621	acknowledge_task	null	{"state": "acknowledged"}	2026-03-08 09:25:20.273
e0463def-86e1-4efa-b35e-f099b11da577	8d774731-9d7b-40ba-9f48-25289ae4685d	task	8f373382-6f7b-434b-8d99-19ce4fcad621	finish_task	null	{"state": "finished", "handoffToUserIds": ["d6163a39-c1c9-4ca6-82df-bac43818bef8"]}	2026-03-08 09:27:25.027
e7b27304-945d-4f2a-9281-a91ca97ea9e3	d6163a39-c1c9-4ca6-82df-bac43818bef8	work_request	22c71287-de37-4437-b454-d65194d25768	ship	{"status": "approved"}	{"status": "shipped", "comment": "DHL has picked up the sampling goods", "dhlTrackingUrl": "https://dhl.com/tracking_1434388322"}	2026-03-08 10:15:25.326
\.


--
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Comment" (id, "workRequestId", "authorUserId", "commentType", body, "createdAt") FROM stdin;
d19c30ea-5acb-499d-b1b2-62fca19d3194	22c71287-de37-4437-b454-d65194d25768	a7cc7905-2af1-4545-b695-5ae3837372af	manager_decision	pls prepare the sampling goods and ship to the customer	2026-03-08 08:19:08.551
518bbce0-e498-466d-9d88-2951f7cf82c6	22c71287-de37-4437-b454-d65194d25768	8d774731-9d7b-40ba-9f48-25289ae4685d	staff_ack	I will start preparing the sampling goods	2026-03-08 09:18:05.577
2cd343e7-3c00-4e79-a84b-438368682a23	22c71287-de37-4437-b454-d65194d25768	62aa5eeb-e18e-44db-929f-dab13d98d6f5	staff_ack	No PR PO required	2026-03-08 09:19:45.862
687f2371-7c46-4a2e-9a9d-9e96270ac606	22c71287-de37-4437-b454-d65194d25768	62aa5eeb-e18e-44db-929f-dab13d98d6f5	staff_finish	Finished	2026-03-08 09:23:41.43
65775b99-c366-402d-a115-50ad68d8cfbc	22c71287-de37-4437-b454-d65194d25768	8d774731-9d7b-40ba-9f48-25289ae4685d	staff_ack	pls give me more time. Material shortage. I will get it tomorrow.	2026-03-08 09:25:20.266
87fb5a2f-4038-447d-b8fa-9f3dd4c730f6	22c71287-de37-4437-b454-d65194d25768	8d774731-9d7b-40ba-9f48-25289ae4685d	handoff	I already put the sampling goods on packaging table	2026-03-08 09:27:25.019
952aa0f4-e6fa-4602-a22b-961f60432d54	22c71287-de37-4437-b454-d65194d25768	8d774731-9d7b-40ba-9f48-25289ae4685d	staff_finish	Sampling Goods is done.	2026-03-08 09:27:25.021
bbbee880-d763-4597-a2f3-5121afe946c7	22c71287-de37-4437-b454-d65194d25768	d6163a39-c1c9-4ca6-82df-bac43818bef8	system	Shipping comment: DHL has picked up the sampling goods	2026-03-08 10:15:25.318
\.


--
-- Data for Name: PasswordResetToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PasswordResetToken" (token, "userId", "expiresAt", "usedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: ProductNode; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ProductNode" (id, name, "parentId", "nodeType", "isActive", "sortOrder", "createdAt", "updatedAt") FROM stdin;
b574a09f-4c6a-4eae-803c-d37518a02364	Acid donor, alkaline donor and buffer	\N	CATEGORY	t	0	2026-03-07 12:24:01.524	2026-03-07 12:24:01.524
3785c887-4234-4689-ae32-d0face334e92	Anti-frosting agent	\N	CATEGORY	t	0	2026-03-07 12:24:45.634	2026-03-07 12:24:45.634
b759d5d5-f1cd-4e02-914a-4a177c763f5c	Anti-migration agent	\N	CATEGORY	t	0	2026-03-07 12:28:12.739	2026-03-07 12:28:12.739
bc99c666-21fe-4822-bd84-77dd55f61e5f	Deaerator / defoamer	\N	CATEGORY	t	0	2026-03-07 12:32:05.374	2026-03-07 12:32:05.374
06c51b5f-8cdd-4e6a-9675-baec81b84e41	Diffusion accelerator / carrier	\N	CATEGORY	t	0	2026-03-07 12:32:58.81	2026-03-07 12:32:58.81
42cab79c-324e-4a24-b0b7-5821ecd1c9c6	CEL	b574a09f-4c6a-4eae-803c-d37518a02364	SUBCATEGORY	t	0	2026-03-07 12:33:58.1	2026-03-07 12:33:58.1
17db6fa0-bfec-4b5b-848d-46c01f30f521	PA/WO/SE	b574a09f-4c6a-4eae-803c-d37518a02364	SUBCATEGORY	t	0	2026-03-07 12:38:40.157	2026-03-07 12:38:40.157
f6709a1b-e692-491b-a9a7-c158a0e62790	PES	b574a09f-4c6a-4eae-803c-d37518a02364	SUBCATEGORY	t	0	2026-03-07 12:40:00.967	2026-03-07 12:40:00.967
3c0be1d7-357c-4d38-a3c7-29decb963394	CEL	b759d5d5-f1cd-4e02-914a-4a177c763f5c	SUBCATEGORY	t	0	2026-03-07 12:43:03.041	2026-03-07 12:43:03.041
499a38e0-f15a-4807-9a66-a8f22f9362f0	PES	b759d5d5-f1cd-4e02-914a-4a177c763f5c	SUBCATEGORY	t	0	2026-03-07 12:43:25.916	2026-03-07 12:43:25.916
262d8f20-0e75-4fac-a3b4-cb2e15d53dc8	Aramid	06c51b5f-8cdd-4e6a-9675-baec81b84e41	SUBCATEGORY	t	0	2026-03-07 12:44:04.876	2026-03-07 12:44:04.876
dc1b8af9-326b-4b69-8283-a4c01db7d50e	PAN	06c51b5f-8cdd-4e6a-9675-baec81b84e41	SUBCATEGORY	t	0	2026-03-07 12:44:19.439	2026-03-07 12:44:19.439
7ab57be3-6c84-4de0-9a58-0818f3429472	TANACID AB 02	42cab79c-324e-4a24-b0b7-5821ecd1c9c6	PRODUCT	t	0	2026-03-07 12:45:39.63	2026-03-07 12:45:39.63
52d4588b-affc-4c07-b81b-13f8d5597f21	TANACID AGP	42cab79c-324e-4a24-b0b7-5821ecd1c9c6	PRODUCT	t	0	2026-03-07 12:47:46.783	2026-03-07 12:47:46.783
e14da699-ae7e-4149-b4d4-eb1532617280	TANACID ARB	42cab79c-324e-4a24-b0b7-5821ecd1c9c6	PRODUCT	t	0	2026-03-07 12:48:08.392	2026-03-07 12:48:08.392
2e1aa5bd-5100-4d3c-bc3f-e8b1e397c938	TANACID NA 01	42cab79c-324e-4a24-b0b7-5821ecd1c9c6	PRODUCT	t	0	2026-03-07 12:48:30.731	2026-03-07 12:48:30.731
a4158a68-0e5b-4a0f-a869-373fd3cbe516	TANACID NAC	42cab79c-324e-4a24-b0b7-5821ecd1c9c6	PRODUCT	t	0	2026-03-07 12:48:51.956	2026-03-07 12:48:51.956
2c1096b9-b17b-48a8-b46c-d92557bb6fb8	TANACID SAB	42cab79c-324e-4a24-b0b7-5821ecd1c9c6	PRODUCT	t	0	2026-03-07 12:49:03.274	2026-03-07 12:49:03.274
e5e2369c-a93e-4b71-9491-bb13190d016a	TANACID UNA	42cab79c-324e-4a24-b0b7-5821ecd1c9c6	PRODUCT	t	0	2026-03-07 12:49:14.777	2026-03-07 12:49:14.777
ff7245eb-c882-4bf5-8171-210d08e73dcb	TANACID AGP	17db6fa0-bfec-4b5b-848d-46c01f30f521	PRODUCT	t	0	2026-03-07 12:49:38.335	2026-03-07 12:49:38.335
07cf5cd9-d620-487f-9855-330ee60a5db9	TANACID NAC	17db6fa0-bfec-4b5b-848d-46c01f30f521	PRODUCT	t	0	2026-03-07 12:49:57.266	2026-03-07 12:49:57.266
0334a76e-4fa6-4ed9-9572-e03a4471b91a	TANACID SAB	17db6fa0-bfec-4b5b-848d-46c01f30f521	PRODUCT	t	0	2026-03-07 12:50:14.64	2026-03-07 12:50:14.64
02b3eaad-f6de-4100-a7b8-20345f92bd22	TANACID UNA	17db6fa0-bfec-4b5b-848d-46c01f30f521	PRODUCT	t	0	2026-03-07 12:50:26.936	2026-03-07 12:50:26.936
984931bf-326a-460b-bba2-79958d5d50cb	TANACID AB 02	f6709a1b-e692-491b-a9a7-c158a0e62790	PRODUCT	t	0	2026-03-07 12:50:57.748	2026-03-07 12:50:57.748
6e58f3fe-5d9d-4dae-bb55-a25976c8dd33	TANACID ARB	f6709a1b-e692-491b-a9a7-c158a0e62790	PRODUCT	t	0	2026-03-07 12:51:14.363	2026-03-07 12:51:14.363
db7ff0a0-4449-4076-84d7-26eda051067a	TANACID SAB	f6709a1b-e692-491b-a9a7-c158a0e62790	PRODUCT	t	0	2026-03-07 12:51:28.075	2026-03-07 12:51:28.075
a84affbf-0b00-40fd-bc65-c70b9abab0e4	TANALEV AFP	3785c887-4234-4689-ae32-d0face334e92	PRODUCT	t	0	2026-03-07 12:52:00.063	2026-03-07 12:52:00.063
fca9ac40-edcf-4df7-b022-c84ed0a151a3	PES	06c51b5f-8cdd-4e6a-9675-baec81b84e41	SUBCATEGORY	t	0	2026-03-07 13:25:00.263	2026-03-07 13:25:00.263
935d9cb3-5b69-48c1-b334-3603702429e6	TANADE MIP 01	3c0be1d7-357c-4d38-a3c7-29decb963394	PRODUCT	t	0	2026-03-07 13:26:45.99	2026-03-07 13:26:45.99
f0dedce0-aa7d-4a64-9854-4f1a7bf66c98	TANADE MIP 01	499a38e0-f15a-4807-9a66-a8f22f9362f0	PRODUCT	t	0	2026-03-07 13:27:17.315	2026-03-07 13:27:17.315
52fb8a5c-d910-4be1-904d-44ba11204dd4	NOFOAM AF	bc99c666-21fe-4822-bd84-77dd55f61e5f	PRODUCT	t	0	2026-03-07 13:27:54.288	2026-03-07 13:27:54.288
8053e4ce-9127-471a-a618-46d3f643582d	NOFOAM DS	bc99c666-21fe-4822-bd84-77dd55f61e5f	PRODUCT	t	0	2026-03-07 13:28:05.832	2026-03-07 13:28:05.832
aac3a6ba-9f7c-493e-b90b-fe5938e8dd60	NOFOAM HT	bc99c666-21fe-4822-bd84-77dd55f61e5f	PRODUCT	t	0	2026-03-07 13:28:16.043	2026-03-07 13:28:16.043
8cb883eb-19c7-4062-9582-d42ca66b2b0d	RESPUMIT BA 2000	bc99c666-21fe-4822-bd84-77dd55f61e5f	PRODUCT	t	0	2026-03-07 13:28:57.139	2026-03-07 13:28:57.139
4f8f6670-9da5-4de3-9034-b5b546bd391b	RESPUMIT NF 01	bc99c666-21fe-4822-bd84-77dd55f61e5f	PRODUCT	t	0	2026-03-07 13:29:23.094	2026-03-07 13:29:23.094
19a264a5-ecc3-4413-bc04-15f29c8b4838	RESPUMIT S	bc99c666-21fe-4822-bd84-77dd55f61e5f	PRODUCT	t	0	2026-03-07 13:29:32.663	2026-03-07 13:29:32.663
05bd94e1-8edb-450a-b79a-4b4a8ace0e76	LEVELGAL C 55	262d8f20-0e75-4fac-a3b4-cb2e15d53dc8	PRODUCT	t	0	2026-03-07 13:30:00.558	2026-03-07 13:30:00.558
6af96576-26c8-42ac-8adf-fecf3ee5a0cf	TANASSIST ACE-N	dc1b8af9-326b-4b69-8283-a4c01db7d50e	PRODUCT	t	0	2026-03-07 13:30:32.036	2026-03-07 13:30:32.036
801cff77-3e04-46f2-9970-d2059494f3ef	TANAVOL AS 01	fca9ac40-edcf-4df7-b022-c84ed0a151a3	PRODUCT	t	0	2026-03-07 13:31:02.176	2026-03-07 13:31:02.176
5b8214fa-5490-4714-ae46-eccf704091d9	TANAVOL DAP	fca9ac40-edcf-4df7-b022-c84ed0a151a3	PRODUCT	t	0	2026-03-07 13:31:14.879	2026-03-07 13:31:14.879
7ff66df1-8ac5-4560-9acf-8491cd5a56dc	TANAVOL PEP 01	fca9ac40-edcf-4df7-b022-c84ed0a151a3	PRODUCT	t	0	2026-03-07 13:31:26.579	2026-03-07 13:31:26.579
\.


--
-- Data for Name: Setting; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Setting" (key, value, "updatedAt") FROM stdin;
app_base_url	"http://localhost:5173"	2026-02-21 07:36:21.14
manufacturing_group_email	"manufacturing@example.com"	2026-02-21 07:36:21.14
\.


--
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Task" (id, "workRequestId", "assigneeUserId", "taskRole", state, "acknowledgedAt", "finishedAt", "createdAt", "updatedAt") FROM stdin;
29d12178-0ebd-42f9-b65e-3337ff26ca93	22c71287-de37-4437-b454-d65194d25768	62aa5eeb-e18e-44db-929f-dab13d98d6f5	PURCHASING	finished	2026-03-08 09:19:45.794	2026-03-08 09:23:41.412	2026-03-08 08:19:08.568	2026-03-08 09:23:41.415
8f373382-6f7b-434b-8d99-19ce4fcad621	22c71287-de37-4437-b454-d65194d25768	8d774731-9d7b-40ba-9f48-25289ae4685d	PRODUCTION_ENGINEER	finished	2026-03-08 09:25:20.26	2026-03-08 09:27:25.011	2026-03-08 08:19:08.568	2026-03-08 09:27:25.012
d5cff55b-bc01-4fbe-960d-d755f5de9589	22c71287-de37-4437-b454-d65194d25768	d6163a39-c1c9-4ca6-82df-bac43818bef8	LOGISTICS	active	\N	\N	2026-03-08 08:19:08.568	2026-03-08 08:19:08.568
\.


--
-- Data for Name: TaskHandoff; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TaskHandoff" (id, "workRequestId", "fromUserId", "toUserId", note, "createdAt") FROM stdin;
5355d1fe-b7b2-4dfc-9934-98a259bea1d4	22c71287-de37-4437-b454-d65194d25768	8d774731-9d7b-40ba-9f48-25289ae4685d	d6163a39-c1c9-4ca6-82df-bac43818bef8	I already put the sampling goods on packaging table	2026-03-08 09:27:25.015
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, "passwordHash", "displayName", phone, role, "staffType", "isActive", "createdAt", "updatedAt") FROM stdin;
fcda1502-f429-4ae8-baeb-7ae4e2d9a358	admin@gsr.local	$2a$12$dnWDJa7IZgRzzML.T7jec.W74lOXmI5oHFcmPZIY.aZS1bqmgRKWi	Admin User	\N	ADMIN	\N	t	2026-02-21 02:54:27.184	2026-02-21 07:13:12.563
93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	requestor@gsr.local	$2a$12$sp9DyQ3KZr9eNvaP5AWmWuG4v7vDd4LK6/SfENK4I.j2aFkYqjBz.	Requestor User	\N	REQUESTOR	\N	t	2026-02-21 02:54:27.667	2026-02-21 07:13:13.035
8d774731-9d7b-40ba-9f48-25289ae4685d	production@gsr.local	$2a$12$pZm1rUepFpZTSHMoYkk4ZuTIpztx7WYUiZrwXXyMp5q8vfKvTgdWO	Production Engineer	\N	STAFF	PRODUCTION_ENGINEER	t	2026-02-21 02:54:27.899	2026-02-21 07:13:13.259
62aa5eeb-e18e-44db-929f-dab13d98d6f5	purchasing@gsr.local	$2a$12$1BTFnwzioAOPO4soGOoS/.CM1OS0vZYNe5hOX7Er0WiMcPTYOWwSC	Purchasing Staff	\N	STAFF	PURCHASING	t	2026-02-21 02:54:28.13	2026-02-21 07:13:13.479
d6163a39-c1c9-4ca6-82df-bac43818bef8	logistics@gsr.local	$2a$12$Kqv0sHDPZpyB.T2ffU44j.ERRXnw.7.mdQcfGmKL00i45em0DdMca	Logistics Staff	\N	STAFF	LOGISTICS	t	2026-02-21 02:54:28.358	2026-02-21 07:13:13.707
10e069b1-b444-49bf-97c2-4fa61115fff0	peerapol@itpattana.com	$2a$12$eR7U9blLIV9pohFKvuupPeu0h2YZjqlfci9iVgsiqYXRerWpU.79a	Peerapol	\N	STAFF	PRODUCTION_ENGINEER	t	2026-02-24 08:49:11.376	2026-02-24 08:49:11.376
19732409-1a47-4401-802b-a34de920a5c4	test2@gsr.local	$2a$12$FQnC64pWK08F70MTG5/2pubrXidR9TO4z79jaXwApFSLpRGeHbHrG	Test2	\N	REQUESTOR	\N	f	2026-03-06 14:27:40.258	2026-03-07 09:39:13.569
a7cc7905-2af1-4545-b695-5ae3837372af	manager@gsr.local	$2a$12$c/X7CoCAwWONtRONQklg2eqK17ITXz03JgyHBTDtgafApBdgfJz3W	Sales Manager	\N	SALES_MANAGER	\N	t	2026-02-21 02:54:27.435	2026-03-07 11:30:19.227
\.


--
-- Data for Name: WorkRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."WorkRequest" (id, "workRequestNo", "requestorUserId", "productNodeId", status, purpose, "volumeKg", "unitCount", "receivingAddress", "receivingPersonFirstname", "receivingPersonLastname", "receivingPersonEmail", "receivingPersonPhone", "targetReceivingBy", "dhlTrackingUrl", "extraFields", "createdAt", "updatedAt") FROM stdin;
22c71287-de37-4437-b454-d65194d25768	GSR-20260308-0001	93a3b3d3-9753-4a61-a616-dcb0ef45a6fd	6e58f3fe-5d9d-4dae-bb55-a25976c8dd33	shipped	To test with Wool to see shading effect	10.000	2	Australia Wool Company	John	Doe	john@example.com	123456789	2026-04-01	https://dhl.com/tracking_1434388322	\N	2026-03-08 02:41:40.126	2026-03-08 10:15:25.303
\.


--
-- Data for Name: WorkRequestAssignment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."WorkRequestAssignment" (id, "workRequestId", "userId", "assignedBy", "assignedRole", "createdAt") FROM stdin;
4ec721d1-977e-4033-bc8c-77654d35b187	22c71287-de37-4437-b454-d65194d25768	8d774731-9d7b-40ba-9f48-25289ae4685d	a7cc7905-2af1-4545-b695-5ae3837372af	PRODUCTION_ENGINEER	2026-03-08 08:19:08.561
691168fd-19bd-4187-a86a-ea4cf113580d	22c71287-de37-4437-b454-d65194d25768	62aa5eeb-e18e-44db-929f-dab13d98d6f5	a7cc7905-2af1-4545-b695-5ae3837372af	PURCHASING	2026-03-08 08:19:08.561
ec1c4916-1969-406d-8be9-e86f7979b60a	22c71287-de37-4437-b454-d65194d25768	d6163a39-c1c9-4ca6-82df-bac43818bef8	a7cc7905-2af1-4545-b695-5ae3837372af	LOGISTICS	2026-03-08 08:19:08.561
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
73791003-a197-4e37-bb4b-eb97d0fe4f2b	a8456dcdeef07a879afcf7c675abd45d872010d406f831af7d67c97b22af4270	2026-02-21 09:48:09.830556+07	20260221024809_init	\N	\N	2026-02-21 09:48:09.772642+07	1
\.


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: PasswordResetToken PasswordResetToken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY (token);


--
-- Name: ProductNode ProductNode_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ProductNode"
    ADD CONSTRAINT "ProductNode_pkey" PRIMARY KEY (id);


--
-- Name: Setting Setting_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Setting"
    ADD CONSTRAINT "Setting_pkey" PRIMARY KEY (key);


--
-- Name: TaskHandoff TaskHandoff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TaskHandoff"
    ADD CONSTRAINT "TaskHandoff_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WorkRequestAssignment WorkRequestAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WorkRequestAssignment"
    ADD CONSTRAINT "WorkRequestAssignment_pkey" PRIMARY KEY (id);


--
-- Name: WorkRequest WorkRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WorkRequest"
    ADD CONSTRAINT "WorkRequest_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AuditLog_entityType_entityId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON public."AuditLog" USING btree ("entityType", "entityId", "createdAt");


--
-- Name: Comment_workRequestId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Comment_workRequestId_createdAt_idx" ON public."Comment" USING btree ("workRequestId", "createdAt");


--
-- Name: PasswordResetToken_userId_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON public."PasswordResetToken" USING btree ("userId", "expiresAt");


--
-- Name: ProductNode_parentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ProductNode_parentId_idx" ON public."ProductNode" USING btree ("parentId");


--
-- Name: TaskHandoff_workRequestId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TaskHandoff_workRequestId_idx" ON public."TaskHandoff" USING btree ("workRequestId");


--
-- Name: Task_assigneeUserId_state_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Task_assigneeUserId_state_idx" ON public."Task" USING btree ("assigneeUserId", state);


--
-- Name: Task_workRequestId_assigneeUserId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Task_workRequestId_assigneeUserId_key" ON public."Task" USING btree ("workRequestId", "assigneeUserId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: WorkRequestAssignment_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "WorkRequestAssignment_userId_idx" ON public."WorkRequestAssignment" USING btree ("userId");


--
-- Name: WorkRequestAssignment_workRequestId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "WorkRequestAssignment_workRequestId_idx" ON public."WorkRequestAssignment" USING btree ("workRequestId");


--
-- Name: WorkRequestAssignment_workRequestId_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "WorkRequestAssignment_workRequestId_userId_key" ON public."WorkRequestAssignment" USING btree ("workRequestId", "userId");


--
-- Name: WorkRequest_requestorUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "WorkRequest_requestorUserId_createdAt_idx" ON public."WorkRequest" USING btree ("requestorUserId", "createdAt");


--
-- Name: WorkRequest_status_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "WorkRequest_status_createdAt_idx" ON public."WorkRequest" USING btree (status, "createdAt");


--
-- Name: WorkRequest_workRequestNo_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "WorkRequest_workRequestNo_key" ON public."WorkRequest" USING btree ("workRequestNo");


--
-- Name: AuditLog AuditLog_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Comment Comment_authorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Comment Comment_workRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_workRequestId_fkey" FOREIGN KEY ("workRequestId") REFERENCES public."WorkRequest"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PasswordResetToken PasswordResetToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ProductNode ProductNode_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ProductNode"
    ADD CONSTRAINT "ProductNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."ProductNode"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TaskHandoff TaskHandoff_fromUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TaskHandoff"
    ADD CONSTRAINT "TaskHandoff_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskHandoff TaskHandoff_toUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TaskHandoff"
    ADD CONSTRAINT "TaskHandoff_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TaskHandoff TaskHandoff_workRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TaskHandoff"
    ADD CONSTRAINT "TaskHandoff_workRequestId_fkey" FOREIGN KEY ("workRequestId") REFERENCES public."WorkRequest"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Task Task_assigneeUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Task Task_workRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_workRequestId_fkey" FOREIGN KEY ("workRequestId") REFERENCES public."WorkRequest"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkRequestAssignment WorkRequestAssignment_assignedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WorkRequestAssignment"
    ADD CONSTRAINT "WorkRequestAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkRequestAssignment WorkRequestAssignment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WorkRequestAssignment"
    ADD CONSTRAINT "WorkRequestAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkRequestAssignment WorkRequestAssignment_workRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WorkRequestAssignment"
    ADD CONSTRAINT "WorkRequestAssignment_workRequestId_fkey" FOREIGN KEY ("workRequestId") REFERENCES public."WorkRequest"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkRequest WorkRequest_productNodeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WorkRequest"
    ADD CONSTRAINT "WorkRequest_productNodeId_fkey" FOREIGN KEY ("productNodeId") REFERENCES public."ProductNode"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: WorkRequest WorkRequest_requestorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."WorkRequest"
    ADD CONSTRAINT "WorkRequest_requestorUserId_fkey" FOREIGN KEY ("requestorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

