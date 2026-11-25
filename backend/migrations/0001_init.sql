CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 60),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE challenges (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    household_id UUID REFERENCES households(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('listrik', 'transportasi', 'terbarukan')),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
    description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 800),
    kwh_saved DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (kwh_saved BETWEEN 0 AND 100000),
    co2_saved DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (co2_saved BETWEEN 0 AND 100000),
    location TEXT NOT NULL CHECK (char_length(location) BETWEEN 2 AND 80),
    time_label TEXT NOT NULL DEFAULT 'Baru saja',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX challenges_created_idx ON challenges (created_at DESC);
CREATE INDEX challenges_household_idx ON challenges (household_id);

CREATE TABLE challenge_joins (
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    challenge_id BIGINT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (household_id, challenge_id)
);

CREATE INDEX challenge_joins_challenge_idx ON challenge_joins (challenge_id);

CREATE TABLE pledges (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    points SMALLINT NOT NULL CHECK (points BETWEEN 1 AND 100),
    sort_order SMALLINT NOT NULL UNIQUE
);

CREATE TABLE pledge_completions (
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    pledge_code TEXT NOT NULL REFERENCES pledges(code) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (household_id, pledge_code)
);

CREATE TABLE energy_assessments (
    household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
    kwh_monthly INTEGER NOT NULL CHECK (kwh_monthly BETWEEN 50 AND 2000),
    ac_hours SMALLINT NOT NULL CHECK (ac_hours BETWEEN 0 AND 24),
    transport TEXT NOT NULL CHECK (transport IN ('public', 'motor', 'car')),
    led BOOLEAN NOT NULL,
    unplug BOOLEAN NOT NULL,
    effective_kwh INTEGER NOT NULL CHECK (effective_kwh >= 0),
    total_co2_kg INTEGER NOT NULL CHECK (total_co2_kg >= 0),
    cost_rp BIGINT NOT NULL CHECK (cost_rp >= 0),
    grade CHAR(1) NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'E')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE community_baseline (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    kwh_saved DOUBLE PRECISION NOT NULL CHECK (kwh_saved >= 0),
    co2_prevented DOUBLE PRECISION NOT NULL CHECK (co2_prevented >= 0),
    households INTEGER NOT NULL CHECK (households >= 0)
);

INSERT INTO community_baseline (id, kwh_saved, co2_prevented, households)
VALUES (TRUE, 3890, 6412, 1248);

INSERT INTO pledges (code, title, description, category, points, sort_order) VALUES
('ac_24', 'Atur Suhu AC di 24°C – 25°C',
 'Setiap kenaikan 1°C menghemat konsumsi listrik kompresor AC hingga 6–10%.',
 'AC & Pendingin', 15, 1),
('unplug_standby', 'Matikan & Cabut Charger / TV Saat Tidak Dipakai',
 'Mencegah kebocoran arus listrik standby power sepanjang malam.',
 'Hemat Listrik', 15, 2),
('natural_light', 'Manfaatkan Pencahayaan & Ventilasi Alami Siang Hari',
 'Buka tirai jendela dan matikan seluruh lampu ruangan di siang hari.',
 'Alami & Hijau', 15, 3),
('public_transport', 'Gunakan Transportasi Publik / Jalan Kaki / Bersepeda',
 'Mengurangi konsumsi BBM fosil secara langsung (mendukung Target SDG 12.c).',
 'Transportasi 12.c', 20, 4),
('full_load_laundry', 'Cuci Pakaian Sekaligus dengan Kapasitas Penuh',
 'Mengoptimalkan daya motor mesin cuci & menjemur pakaian dengan sinar matahari.',
 'Hemat Air & Energi', 15, 5),
('skem_appliance', 'Pilih Elektronik Berlabel Tanda Hemat Energi (Bintang 4/5)',
 'Mendorong produsen memproduksi perangkat efisien sesuai standar SKEM nasional.',
 'Label SKEM 12.8', 20, 6);

-- Seed inserted in reverse display order so created_at DESC renders 1..6 as the original UI.
INSERT INTO challenges (category, title, description, kwh_saved, co2_saved, location, time_label, created_at) VALUES
('listrik', 'Cuci Pakaian Full Load + Jemur Alami',
 'Kumpulkan cucian hingga penuh kapasitas mesin cuci lalu jemur di bawah sinar matahari — tidak menggunakan pengering listrik.',
 0.9, 0.8, 'Semua Wilayah', 'Hari ini', now() - interval '50 minutes'),
('listrik', 'Cabut Semua Perangkat Standby Malam Ini',
 'Sebelum tidur, cabut semua colokan TV, set-top box, charger, dan microwave untuk menghilangkan 100% beban vampire power.',
 0.4, 0.3, 'Nasional', 'Malam ini', now() - interval '40 minutes'),
('terbarukan', 'Pasang Panel Surya Komunitas RT/RW',
 'Inisiasi pengadaan panel surya bersama untuk dipasang di atap balai RT/RW atau fasilitas umum setempat.',
 180.0, 153.0, 'Bandung', 'Kuartal ini', now() - interval '30 minutes'),
('listrik', 'Audit Lampu Rumah (Ganti ke LED)',
 'Hitung berapa lampu non-LED yang masih ada di rumah Anda dan ganti dengan LED hemat energi. Satu langkah nyata menuju SDG 12.8.',
 8.0, 6.8, 'Semua Wilayah', 'Bulan ini', now() - interval '20 minutes'),
('transportasi', 'Gunakan Sepeda/Angkutan Umum 3 Hari',
 'Tantang diri Anda menggunakan sepeda atau angkutan umum selama 3 hari berturut-turut sebagai pengganti kendaraan pribadi berbahan bakar fosil.',
 0, 15.0, 'Nasional', 'Minggu ini', now() - interval '10 minutes'),
('listrik', 'Matikan AC Semalam',
 'Coba tidur tanpa AC semalam dengan membuka jendela dan menggunakan kipas angin. Hemat energi mulai dari malam ini.',
 1.2, 1.0, 'Jabodetabek', 'Malam ini', now());
